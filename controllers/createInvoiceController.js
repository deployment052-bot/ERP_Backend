import sequelize from "../config/db.js";
import Bill from "../models/Bill.js";
import BillItem from "../models/BillItem.js";
import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";
import InvoiceItem from "../models/InvoiceItem.js";
import LedgerEntry from "../models/LedgerEntry.js";

export const createInvoice = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { bill_id, customer } = req.body;

    
    if (!bill_id) throw new Error("bill_id is required");
    if (!customer || !customer.phone || !customer.name) {
      throw new Error("Customer name and phone are required");
    }

    
    const bill = await Bill.findByPk(bill_id, { raw: true });
    if (!bill) throw new Error("Bill not found");

   
    const billItems = await BillItem.findAll({
      where: { bill_id },
      raw: true
    });
    if (!billItems.length) throw new Error("No items found in this bill");

   
    const [cust] = await Customer.findOrCreate({
      where: {
        phone: customer.phone,
        store_code: bill.store_code
      },
      defaults: {
        name: customer.name,
        phone: customer.phone,
        address: customer.address || "",
        pincode: customer.pincode || "",
        store_code: bill.store_code,
        organization_id: bill.organization_id
      },
      transaction: t
    });

    
    let subtotal = 0;

    billItems.forEach(item => {
      subtotal += Number(item.total_amount);
    });

    const cgst = subtotal * 0.015;  
    const sgst = subtotal * 0.015;

    const totalWithTax = subtotal + cgst + sgst;
    const roundOff = Math.round(totalWithTax) - totalWithTax;
    const finalAmount = totalWithTax + roundOff;

    // ================= CREATE INVOICE =================
    const invoice = await Invoice.create({
      bill_id,
      customer_id: cust.id,
      total_amount: Number(finalAmount.toFixed(2)),
      received_amount: 0,
      pending_amount: Number(finalAmount.toFixed(2)),
      status: "UNPAID",
      store_code: bill.store_code,
      organization_id: bill.organization_id
    }, { transaction: t });

    // ================= INVOICE ITEMS =================
    for (let item of billItems) {
      await InvoiceItem.create({
        invoice_id: invoice.id,
        item_id: item.item_id,
        product_code: item.product_code,
        description: item.description,
        net_weight: item.net_weight,
        rate: item.rate,
        making_charge_percent: item.making_charge_percent,
        making_charge_value: item.making_charge_value,
        total_amount: item.total_amount
      }, { transaction: t });
    }
/***
 * @description: Create a ledger entry for the invoice. This will debit the customer's account since they owe us money for the invoice.
 */
   
    await LedgerEntry.create({
      customer_id: cust.id,
      type: "DEBIT",
      amount: Number(finalAmount.toFixed(2)),
      reference_type: "INVOICE",
      reference_id: invoice.id,
      description: `Invoice #${invoice.id} created`
    }, { transaction: t });

    await t.commit();

    
    res.status(201).json({
      success: true,
      data: {
        header: {
          company_name: "Merxenta Global Private Limited",
          address: "H.No. 999/9, Gurgaon, Haryana",
          phone: "0120-2562111",
          gstin: "XXXXXXXX"
        },

        customer_details: {
          name: cust.name,
          phone: cust.phone,
          address: cust.address,
          invoice_no: invoice.id,
          invoice_date: new Date().toISOString().split("T")[0]
        },

        items: billItems.map((item, index) => ({
          sno: index + 1,
          product_code: item.product_code,
          description: item.description,
          hsn_code: "71131913",
          purity: "18KT",
          gross_weight: item.net_weight,
          net_weight: item.net_weight,
          rate: item.rate,
          value: Number((item.net_weight * item.rate).toFixed(2)),
          making_charge_percent: item.making_charge_percent,
          making_charge_value: item.making_charge_value,
          amount: item.total_amount
        })),

        summary: {
          subtotal: Number(subtotal.toFixed(2)),
          cgst: Number(cgst.toFixed(2)),
          sgst: Number(sgst.toFixed(2)),
          total_with_tax: Number(totalWithTax.toFixed(2)),
          round_off: Number(roundOff.toFixed(2)),
          final_amount: Number(finalAmount.toFixed(2))
        },

        footer: {
          note: "This is computer generated invoice",
          terms: [
            "No warranty on physical damage",
            "Goods once sold not returnable"
          ]
        }
      }
    });

  } catch (error) {
    await t.rollback();
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};