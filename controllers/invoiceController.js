import db from "../config/db.js";
import {
  Invoice,
  InvoiceItem,
  LedgerEntry,
  Customer,
  Payment,
} from "../models/index.js";

/**
 * @desc    Create new invoice with items + ledger entry (Screenshot 2)
 * @route   POST /api/invoice
 * @access  Private
 */
export const createInvoice = async (req, res) => {
  let t;

  try {
    t = await db.transaction();

    const { items, customer_id, ...data } = req.body;
    const organization_id =1
    const created_by = 1

    if (!items || items.length === 0) {
      throw new Error("Invoice must contain at least one item");
    }

    let grandTotal = 0;
    const itemData = [];

    // Process each item
    for (const i of items) {
      const gross = parseFloat(i.gross_weight);
      const less = parseFloat(i.less_weight || 0);
      const rate = parseFloat(i.rate);
      const makingPercent = parseFloat(i.making_charge_percent || 0);

      const netWeight = gross - less;
      const value = netWeight * rate;
      const makingValue = (value * makingPercent) / 100;
      const totalAmount = value + makingValue;

      grandTotal += totalAmount;

      itemData.push({
         item_id: i.item_id,          
        quantity: i.quantity || 1,
        product_code: i.product_code,
        description: i.description,
        hsn_code: i.hsn_code,
        purity: i.purity,
        gross_weight: gross.toFixed(3),
        less_weight: less.toFixed(3),
        net_weight: netWeight.toFixed(3),
        rate: rate.toFixed(2),
        value: value.toFixed(2),
        making_charge_percent: makingPercent.toFixed(2),
        making_charge_value: makingValue.toFixed(2),
        total_amount: totalAmount.toFixed(2),
      });
    }

    // Generate unique invoice number
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const invoice_number = `INV-${timestamp}-${random}`;

    // Create invoice
    const invoice = await Invoice.create(
      {
        ...data,
        invoice_number,
        item_id: items[0].item_id, // Assuming first item for reference
        customer_id,
        organization_id,
        total_amount: grandTotal.toFixed(2),
        pending_amount: grandTotal.toFixed(2),
        received_amount: "0.00",
        status: "UNPAID",
        created_by,
      },
      { transaction: t }
    );

    // Create invoice items
    const finalItems = itemData.map((item) => ({
      ...item,
      invoice_id: invoice.id,
    }));

    await InvoiceItem.bulkCreate(finalItems, { transaction: t });

    // Create LEDGER DEBIT entry (Customer ne maal liya)
    await LedgerEntry.create(
      {
        customer_id,
        organization_id,
        type: "DEBIT",
        amount: grandTotal.toFixed(2),
        reference_type: "INVOICE",
        reference_id: invoice.id,
        description: `Invoice ${invoice_number} created`,
      },
      { transaction: t }
    );

    await t.commit();

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: {
        invoice_id: invoice.id,
        invoice_number,
        total_amount: grandTotal.toFixed(2),
        pending_amount: grandTotal.toFixed(2),
        status: "UNPAID",
        items_count: items.length,
      },
    });
  } catch (err) {
    if (t) await t.rollback();
    console.error("Create Invoice Error:", err);
    res.status(400).json({ success: false, error: err.message });
  }
};

/**
 * @desc    Get invoice detail with items and payments (Screenshot 5, 6)
 * @route   GET /api/invoice/detail/:invoice_id
 * @access  Private
 */
export const getInvoiceDetail = async (req, res) => {
  try {
    const { invoice_id } = req.params;
   

    const invoice = await Invoice.findOne({
      where: { id: invoice_id,  },
      include: [
        {
          model: Customer,
          attributes: ["id", "name", "phone", "address", "pan_card_number", "pincode"],
        },
        {
          model: InvoiceItem,
          as: "items",
        },
        {
          model: Payment,
          attributes: ["id", "amount", "payment_method", "financier", "txn_id", "operator", "payment_date"],
          order: [["payment_date", "DESC"]],
        },
      ],
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    // Calculate summary for PDF (Screenshot 6)
    const subtotal = parseFloat(invoice.total_amount);
    const makingCharges = invoice.items.reduce(
      (sum, item) => sum + parseFloat(item.making_charge_value),
      0
    );

    res.json({
      success: true,
      data: {
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          total_amount: parseFloat(invoice.total_amount).toFixed(2),
          received_amount: parseFloat(invoice.received_amount).toFixed(2),
          pending_amount: parseFloat(invoice.pending_amount).toFixed(2),
          status: invoice.status,
        },
        customer: invoice.Customer,
        items: invoice.items.map((item) => ({
          ...item.toJSON(),
          gross_weight: parseFloat(item.gross_weight).toFixed(3),
          net_weight: parseFloat(item.net_weight).toFixed(3),
          rate: parseFloat(item.rate).toFixed(2),
          value: parseFloat(item.value).toFixed(2),
          making_charge_value: parseFloat(item.making_charge_value).toFixed(2),
          total_amount: parseFloat(item.total_amount).toFixed(2),
        })),
        payments: invoice.Payments.map((p) => ({
          id: p.id,
          amount: parseFloat(p.amount).toFixed(2),
          payment_method: p.payment_method,
          financier: p.financier,
          txn_id: p.txn_id,
          operator: p.operator,
          payment_date: p.payment_date,
        })),
        summary: {
          subtotal: subtotal.toFixed(2),
          making_charges: makingCharges.toFixed(2),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * @desc    Get all invoices for customer (Screenshot 4)
 * @route   GET /api/invoice/customer/:customer_id
 * @access  Private
 */
export const getCustomerInvoices = async (req, res) => {
  try {
    const { customer_id } = req.params;
    const invoices = await Invoice.findAll({
      where: { customer_id },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: InvoiceItem,
          as: "items",
          attributes: ["id", "description", "total_amount"],
        },
      ],
    });

    res.json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * @desc    Get pending invoices (Screenshot 1 - "Pending Amounts" button)
 * @route   GET /api/invoice/pending
 * @access  Private
 */
export const getPendingInvoices = async (req, res) => {
  try {
    const organization_id = req.user?.organization_id || 1;

    const invoices = await Invoice.findAll({
      where: {
        organization_id,
        status: ["UNPAID", "PARTIAL"],
      },
      include: [
        {
          model: Customer,
          attributes: ["id", "name", "phone"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};