import {
  Payment,
  Invoice,
  Transaction,
  TransactionEntry,
  LedgerEntry,
  sequelize,
} from "../models/index.js";

//  CREATE PAYMENT
export const createPayment = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { invoice_id, amount } = req.body;

    const invoice = await Invoice.findByPk(invoice_id);

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (amount > invoice.pending_amount) {
      throw new Error("Overpayment not allowed");
    }

    //  Create Payment
    const payment = await Payment.create(
      { invoice_id, amount },
      { transaction: t }
    );

    //  Update Invoice
    invoice.received_amount += parseFloat(amount);
    invoice.pending_amount -= parseFloat(amount);

    invoice.status =
      invoice.pending_amount <= 0 ? "PAID" : "PARTIAL";

    await invoice.save({ transaction: t });

    //  Accounting Transaction
    const txn = await Transaction.create(
      { transaction_date: new Date() },
      { transaction: t }
    );

    await TransactionEntry.bulkCreate(
      [
        {
          transaction_id: txn.id,
          account_id: 1,
          debit: amount,
        },
        {
          transaction_id: txn.id,
          account_id: 2,
          credit: amount,
        },
      ],
      { transaction: t }
    );

    //  IMPORTANT: CREATE LEDGER ENTRY (CREDIT)
    await LedgerEntry.create(
      {
        customer_id: invoice.customer_id,
        type: "CREDIT",
        amount: amount,
        reference_type: "PAYMENT",
        reference_id: payment.id,
        description: "Payment received",
      },
      { transaction: t }
    );

    await t.commit();

    res.json({ message: "Payment Done", payment });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
};


export const getPayments = async (req, res) => {
  try {
    const { invoice_id } = req.params;

    const payments = await Payment.findAll({
      where: { invoice_id },
      include: [
        {
          model: Invoice,
          attributes: ["id", "invoice_number", "total_amount"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};