import Bill from "../model/Bill.js";
import BillItem from "../model/BillItem.js";
import Store from "../model/Store.js";
import Stock from "../model/stockrecord.js";
import StockMovement from "../model/stockmovement.js";
import Item from "../model/item.js";
import Customer from "../model/Customer.js";
import LedgerEntry from "../model/LedgerEntry.js";
import sequelize from "../config/db.js";
import { Op } from "sequelize";

const normalizePhone = (phone) => {
  if (!phone) return null;
  return String(phone).replace(/\D/g, "").trim() || null;
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const generateBillNumber = (storeCode = "STORE") => {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `BILL-${storeCode}-${yyyy}${mm}${dd}${hh}${mi}${ss}`;
};

/**
 * @desc    Create bill with customer + stock deduction + ledger entry
 * @route   POST /api/bills
 * @access  Private
 */
export const createBill = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    if (!req.user?.organization_id || !req.user?.store_code) {
      await t.rollback();
      return res.status(401).json({
        success: false,
        message: "organization_id or store_code missing in req.user",
      });
    }

    const {
      items = [],
      customer_id = null,
      customer = null,
      store_code,
      paid_amount = 0,
      notes = null,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "At least one item is required",
      });
    }

    const cleanStoreCode = String(
      store_code || req.user.store_code || ""
    ).trim().toUpperCase();

    if (!cleanStoreCode) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "store_code is required",
      });
    }

    const store = await Store.findOne({
      where: { store_code: cleanStoreCode },
      transaction: t,
    });

    if (!store) {
      throw new Error("Store not found");
    }

    // =========================
    // CUSTOMER FIND / CREATE
    // =========================
    let finalCustomer = null;

    if (customer_id) {
      finalCustomer = await Customer.findOne({
        where: {
          id: customer_id,
          organization_id: req.user.organization_id,
          store_code: cleanStoreCode,
        },
        transaction: t,
      });

      if (!finalCustomer) {
        throw new Error("Customer not found for this entity");
      }
    } else if (customer && (customer.phone || customer.pan_card_number || customer.name)) {
      const cleanPhone = normalizePhone(customer.phone);
      const cleanPan = customer.pan_card_number
        ? String(customer.pan_card_number).trim().toUpperCase()
        : null;

      const orConditions = [];

      if (cleanPhone) {
        orConditions.push({ phone: cleanPhone });
      }

      if (cleanPan) {
        orConditions.push({ pan_card_number: cleanPan });
      }

      if (orConditions.length > 0) {
        finalCustomer = await Customer.findOne({
          where: {
            organization_id: req.user.organization_id,
            store_code: cleanStoreCode,
            [Op.or]: orConditions,
          },
          transaction: t,
        });
      }

      if (!finalCustomer) {
        if (!customer.name || !String(customer.name).trim()) {
          throw new Error("Customer name is required for new customer");
        }

        finalCustomer = await Customer.create(
          {
            name: String(customer.name).trim(),
            phone: cleanPhone,
            address: customer.address ? String(customer.address).trim() : null,
            pan_card_number: cleanPan,
            pincode: customer.pincode ? String(customer.pincode).trim() : null,
            organization_id: req.user.organization_id,
            organization_level: req.user.organization_level || null,
            store_code: cleanStoreCode,
          },
          { transaction: t }
        );
      }
    }

    // =========================
    // BILL CALCULATION
    // =========================
    const preparedItems = [];
    let grandTotal = 0;

    for (const row of items) {
      const item_id = row.item_id;
      const qty = toNumber(row.qty || 1);
      const net_weight = toNumber(row.net_weight);
      const rate = toNumber(row.rate);
      const making_charge_percent = toNumber(row.making_charge_percent);

      if (!item_id) {
        throw new Error("item_id is required for each item");
      }

      if (qty <= 0) {
        throw new Error(`Invalid qty for item ${item_id}`);
      }

      const dbItem = await Item.findOne({
        where: { id: item_id },
        transaction: t,
      });

      if (!dbItem) {
        throw new Error(`Item not found for item_id ${item_id}`);
      }

      const stock = await Stock.findOne({
        where: {
          item_id,
          organization_id: store.id,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!stock) {
        throw new Error(`Stock not found for item ${item_id}`);
      }

      const openingQty = toNumber(stock.available_qty);
      const openingWeight = toNumber(stock.available_weight);

      if (openingQty < qty) {
        throw new Error(`Insufficient stock qty for item ${item_id}`);
      }

      if (openingWeight < net_weight) {
        throw new Error(`Insufficient stock weight for item ${item_id}`);
      }

      const metalAmount = net_weight * rate;
      const makingChargeValue = (metalAmount * making_charge_percent) / 100;
      const totalAmount = metalAmount + makingChargeValue;

      grandTotal += totalAmount;

      preparedItems.push({
        dbItem,
        stock,
        item_id,
        qty,
        product_code:
          row.product_code ||
          dbItem.product_code ||
          dbItem.article_code ||
          dbItem.sku_code ||
          null,
        description:
          row.description ||
          dbItem.description ||
          dbItem.item_name ||
          null,
        net_weight,
        rate,
        making_charge_percent,
        making_charge_value: makingChargeValue,
        total_amount: totalAmount,
        openingQty,
        openingWeight,
      });
    }

    const paidAmount = toNumber(paid_amount);
    const dueAmount = grandTotal - paidAmount;
    const billNumber = generateBillNumber(cleanStoreCode);

    // =========================
    // BILL CREATE
    // =========================
    const bill = await Bill.create(
      {
        bill_number: billNumber,
        store_code: cleanStoreCode,
        organization_id: Number(store.id),
        customer_id: finalCustomer?.id || null,
        total_amount: Number(grandTotal.toFixed(2)),
        paid_amount: Number(paidAmount.toFixed(2)),
        due_amount: Number(dueAmount.toFixed(2)),
        notes,
      },
      { transaction: t }
    );

    // =========================
    // BILL ITEMS + STOCK UPDATE + MOVEMENT
    // =========================
    for (const row of preparedItems) {
      const updatedQty = row.openingQty - row.qty;
      const updatedWeight = row.openingWeight - row.net_weight;

      await BillItem.create(
        {
          bill_id: bill.id,
          item_id: row.item_id,
          product_code: row.product_code,
          description: row.description,
          net_weight: row.net_weight,
          rate: row.rate,
          making_charge_percent: row.making_charge_percent,
          making_charge_value: Number(row.making_charge_value.toFixed(2)),
          total_amount: Number(row.total_amount.toFixed(2)),
        },
        { transaction: t }
      );

      await row.stock.update(
        {
          available_qty: updatedQty,
          available_weight: updatedWeight,
        },
        { transaction: t }
      );

      await StockMovement.create(
        {
          organization_id: store.id,
          item_id: row.item_id,
          movement_type: "sale",
          reference_type: "BILL",
          reference_id: bill.id,

          qty: row.qty,
          weight: row.net_weight,

          opening_available_qty: row.openingQty,
          closing_available_qty: updatedQty,

          opening_available_weight: row.openingWeight,
          closing_available_weight: updatedWeight,

          remarks: `Item sold via billing (${billNumber})`,
        },
        { transaction: t }
      );

      await Item.update(
        { current_status: "sold" },
        {
          where: { id: row.item_id },
          transaction: t,
        }
      );
    }

    // =========================
    // LEDGER ENTRY
    // =========================
    if (finalCustomer) {
      // bill amount debit
      await LedgerEntry.create(
        {
          customer_id: finalCustomer.id,
          organization_id: req.user.organization_id,
          store_code: cleanStoreCode,
          bill_id: bill.id,
          type: "DEBIT",
          amount: Number(grandTotal.toFixed(2)),
          remarks: `Bill created: ${billNumber}`,
          entry_date: new Date(),
        },
        { transaction: t }
      );

      // payment received credit
      if (paidAmount > 0) {
        await LedgerEntry.create(
          {
            customer_id: finalCustomer.id,
            organization_id: req.user.organization_id,
            store_code: cleanStoreCode,
            bill_id: bill.id,
            type: "CREDIT",
            amount: Number(paidAmount.toFixed(2)),
            remarks: `Payment received against bill: ${billNumber}`,
            entry_date: new Date(),
          },
          { transaction: t }
        );
      }
    }

    await t.commit();

    return res.status(201).json({
      success: true,
      message: "Bill created successfully",
      data: {
        bill_id: bill.id,
        bill_number: bill.bill_number,
        customer_id: finalCustomer?.id || null,
        customer_name: finalCustomer?.name || null,
        total_items: preparedItems.length,
        total_amount: Number(grandTotal.toFixed(2)),
        paid_amount: Number(paidAmount.toFixed(2)),
        due_amount: Number(dueAmount.toFixed(2)),
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("Create Bill Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create bill",
      error: error.message,
    });
  }
};