import {
  Payment,
  Invoice,
  Transaction,
  TransactionEntry,
  LedgerEntry,
  sequelize,
} from "../models/index.js";

/**
 * @desc    Create payment + update invoice + ledger credit + accounting
 * @route   POST /api/payment
 */
export const createPayment = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      invoice_id,
      amount,
      payment_method = "CASH",
      financier = "Self",
      txn_id,
    } = req.body;

    
    const organization_id = req.user?.organization_id || 1;
    const operator = "System";

    // Validate input
    if (!invoice_id || !amount) {
      throw new Error("invoice_id and amount are required");
    }

    // Fetch invoice with lock
    const invoice = await Invoice.findByPk(invoice_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Optional safety check
    if (invoice.organization_id !== organization_id) {
      throw new Error("Unauthorized access to invoice");
    }

    const paymentAmount = parseFloat(amount);
    const pendingAmount = parseFloat(invoice.pending_amount);

    if (paymentAmount <= 0) {
      throw new Error("Invalid payment amount");
    }

    if (paymentAmount > pendingAmount) {
      throw new Error(
        `Overpayment not allowed. Pending: ${pendingAmount.toFixed(2)}`
      );
    }

    // Create Payment
    const payment = await Payment.create(
      {
        invoice_id,
        organization_id,
        amount: paymentAmount.toFixed(2),
        payment_method,
        financier,
        txn_id,
        operator,
        store_code: invoice.store_code,
        payment_date: new Date(),
      },
      { transaction: t }
    );

    // Update Invoice
    const newReceived =
      parseFloat(invoice.received_amount) + paymentAmount;
    const newPending =
      parseFloat(invoice.total_amount) - newReceived;

    invoice.received_amount = newReceived.toFixed(2);
    invoice.pending_amount = newPending.toFixed(2);
    invoice.status = newPending <= 0 ? "PAID" : "PARTIAL";

    await invoice.save({ transaction: t });

    // Create Accounting Transaction
    const txn = await Transaction.create(
      {
        transaction_date: new Date(),
        transaction_type: "PAYMENT_RECEIVED",
        organization_id,
        reference_id: payment.id,
        reference_type: "PAYMENT",
      },
      { transaction: t }
    );

    // Double Entry Accounting
    await TransactionEntry.bulkCreate(
      [
        {
          transaction_id: txn.id,
          account_id: 1, // Cash/Bank
          debit: paymentAmount.toFixed(2),
          credit: "0.00",
        },
        {
          transaction_id: txn.id,
          account_id: 2, // Accounts Receivable
          debit: "0.00",
          credit: paymentAmount.toFixed(2),
        },
      ],
      { transaction: t }
    );

    // Ledger Entry (CREDIT)
    await LedgerEntry.create(
      {
        customer_id: invoice.customer_id,
        organization_id,
        type: "CREDIT",
        amount: paymentAmount.toFixed(2),
        reference_type: "PAYMENT",
        reference_id: payment.id,
        description: `Payment received for Invoice ${invoice.invoice_number}`,
      },
      { transaction: t }
    );

    await t.commit();

    res.json({
      success: true,
      message: "Payment recorded successfully",
      data: {
        payment_id: payment.id,
        invoice_id,
        amount: paymentAmount.toFixed(2),
        payment_method,
        financier,
        operator,
        invoice_status: invoice.status,
        pending_amount: invoice.pending_amount,
        received_amount: invoice.received_amount,
      },
    });
  } catch (err) {
    await t.rollback();
    console.error("Payment Error:", err);

    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * @desc    Get payments by invoice
 * @route   GET /api/payment/invoice/:invoice_id
 */
export const getPaymentsByInvoice = async (req, res) => {
  try {
    const { invoice_id } = req.params;

    
     req.user?.organization_id || 1;
    const payments = await Payment.findAll({
      where: { invoice_id },
      order: [["payment_date", "DESC"]],
    });

    const totalPaid = payments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    );

    res.json({
      success: true,
      count: payments.length,
      total_paid: totalPaid.toFixed(2),
      data: payments.map((p) => ({
        id: p.id,
        amount: parseFloat(p.amount).toFixed(2),
        payment_method: p.payment_method,
        financier: p.financier,
        txn_id: p.txn_id,
        operator: p.operator,
        payment_date: p.payment_date,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    console.error("Get Payments Error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};