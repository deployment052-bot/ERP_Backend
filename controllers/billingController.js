// controllers/billingController.js

import db from "../config/db.js";
import {
  Customer,
  Invoice,
  InvoiceItem,
  LedgerEntry,
} from "../models/index.js";

export const createBilling = async (req, res) => {
  const t = await db.transaction();

  try {
    const { customer, items, organization_id, invoice_date } = req.body;

    if (!items || items.length === 0) {
      throw new Error("Items required");
    }

    // CUSTOMER
    let customerData;

    if (customer.id) {
      customerData = await Customer.findByPk(customer.id);
    } else {
      customerData = await Customer.create(customer, { transaction: t });

      // Opening Balance
      if (customer.total_amount) {
        await LedgerEntry.create({
          customer_id: customerData.id,
          type: "DEBIT",
          amount: customer.total_amount,
          reference_type: "OPENING",
        }, { transaction: t });

        if (customer.received_amount) {
          await LedgerEntry.create({
            customer_id: customerData.id,
            type: "CREDIT",
            amount: customer.received_amount,
            reference_type: "OPENING",
          }, { transaction: t });
        }
      }
    }

    //  2. ITEM CALCULATION
    let grandTotal = 0;

    const processedItems = items.map((i) => {
      const net = i.gross_weight - (i.less_weight || 0);
      const value = net * i.rate;

      const making =
        (value * (i.making_charge_percent || 0)) / 100;

      const total = value + making;

      grandTotal += total;

      return {
        ...i,
        net_weight: net,
        value,
        making_charge_value: making,
        total_amount: total,
      };
    });

    // INVOICE
    const invoice = await Invoice.create({
      invoice_number: "INV-" + Date.now(),
      customer_id: customerData.id,
      total_amount: grandTotal,
      pending_amount: grandTotal,
      received_amount: 0,
      status: "UNPAID",
      invoice_date,
      organization_id,
    }, { transaction: t });

    // Items
    await InvoiceItem.bulkCreate(
      processedItems.map((i) => ({
        ...i,
        invoice_id: invoice.id,
      })),
      { transaction: t }
    );

    //  4. LEDGER (DEBIT)
    await LedgerEntry.create({
      customer_id: customerData.id,
      type: "DEBIT",
      amount: grandTotal,
      reference_type: "INVOICE",
      reference_id: invoice.id,
      description: "Invoice Created",
    }, { transaction: t });

    await t.commit();

    res.json({
      message: "Billing Done ",
      invoice_id: invoice.id,
      total: grandTotal,
    });

  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
};