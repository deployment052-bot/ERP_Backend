import db from "../config/db.js";

import {
  Invoice,
  InvoiceItem,
  LedgerEntry,
  Customer,
} from "../models/index.js";

/**
 * @routes POST /api/invoice
 * @desc Create new invoice with items + ledger entry
 * @access Private
 */
export const createInvoice = async (req, res) => {
  let t;

  try {
    t = await db.transaction();

    const { items, ...data } = req.body;

    if (!items || items.length === 0) {
      throw new Error("Invoice must contain at least one item");
    }

    let grandTotal = 0;

    const itemData = items.map((i) => {
      const gross = parseFloat(i.gross_weight);
      const less = parseFloat(i.less_weight || 0);

      const netWeight = gross - less;
      const value = netWeight * i.rate;

      const makingChargePercent = i.making_charge_percent || 0;
      const makingChargeValue =
        (value * makingChargePercent) / 100;

      const totalAmount = value + makingChargeValue;

      grandTotal += totalAmount;

      return {
        ...i,
        gross_weight: gross,
        less_weight: less,
        net_weight: netWeight,
        value,
        making_charge_percent: makingChargePercent,
        making_charge_value: makingChargeValue,
        total_amount: totalAmount,
      };
    });

    const invoice = await Invoice.create(
      {
        ...data,
        invoice_number: "INV-" + Date.now(),
        total_amount: grandTotal,
        pending_amount: grandTotal,
        received_amount: 0,
      },
      { transaction: t }
    );

    const finalItems = itemData.map((item) => ({
      ...item,
      invoice_id: invoice.id,
    }));

    await InvoiceItem.bulkCreate(finalItems, {
      transaction: t,
    });

    await LedgerEntry.create(
      {
        customer_id: data.customer_id,
        type: "DEBIT",
        amount: grandTotal,
        reference_type: "INVOICE",
        reference_id: invoice.id,
        description: "Invoice created",
      },
      { transaction: t }
    );

    await t.commit();

    res.status(201).json({
      message: "Invoice created successfully",
      invoice_id: invoice.id,
      total_amount: grandTotal,
    });

  } catch (err) {
    if (t) await t.rollback();

    res.status(400).json({
      error: err.message,
    });
  }
};

/**
 * @routes GET /api/invoice/customer/:customer_id
 * @desc Get all invoices for a specific customer
 * @access Private
 */
export const getCustomerInvoices = async (req, res) => {
  try {
    const { customer_id } = req.params;

    const data = await Invoice.findAll({
      where: { customer_id },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: InvoiceItem,
          as: "items", 
        },
      ],
    });

    res.json(data);

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

/**
 * @routes GET /api/invoice/detail/:invoice_id
 * @desc Get detail of a specific invoice
 * @access Private
 */
export const getInvoiceDetail = async (req, res) => {
  try {
    const { invoice_id } = req.params;

    const invoice = await Invoice.findOne({
      where: { id: invoice_id },
      include: [
        {
          model: Customer,
          attributes: ["id", "name", "phone", "address"],
        },
        {
          model: InvoiceItem,
          as: "items", 
        },
      ],
    });

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    res.json(invoice);

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};