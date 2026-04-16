import Bill from "../models/Bill.js";
import BillItem from "../models/BillItem.js";
import Store from "../models/Store.js";
import Stock from "../models/Stock.js";
import StockMovement from "../models/stockMovement.js";
import Item from "../models/Item.js";
import sequelize from "../config/db.js";

export const createBill = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { items, store_code } = req.body;

    const cleanStoreCode = store_code.trim().toUpperCase();

    const store = await Store.findOne({
      where: { store_code: cleanStoreCode },
      raw: true
    });

    if (!store) throw new Error("Store not found");

    const billNumber = "BILL-" + Date.now();

    const bill = await Bill.create({
      bill_number: billNumber,
      store_code: cleanStoreCode,
      organization_id: Number(store.id)
    }, { transaction: t });

    let grandTotal = 0;

    for (let item of items) {

      // ================= CALC =================
      const metal = item.net_weight * item.rate;
      const making = (metal * item.making_charge_percent) / 100;
      const total = metal + making;

      grandTotal += total;

      // ================= BILL ITEM =================
      await BillItem.create({
        bill_id: bill.id,
        item_id: item.item_id,
        product_code: item.product_code,
        description: item.description,
        net_weight: item.net_weight,
        rate: item.rate,
        making_charge_percent: item.making_charge_percent,
        making_charge_value: making,
        total_amount: total
      }, { transaction: t });

      // ================= GET STOCK =================
      const stock = await Stock.findOne({
        where: {
          item_id: item.item_id,
          organization_id: store.id
        },
        transaction: t,
        lock: true
      });

      if (!stock) throw new Error(`Stock not found for item ${item.item_id}`);

      if (Number(stock.available_qty) <= 0) {
        throw new Error(`Out of stock for item ${item.item_id}`);
      }

      // ================= OPENING VALUES =================
      const openingQty = Number(stock.available_qty);
      const openingWeight = Number(stock.available_weight);

      // ================= UPDATE STOCK =================
      const updatedQty = openingQty - 1;
      const updatedWeight = openingWeight - Number(item.net_weight);

      await stock.update({
        available_qty: updatedQty,
        available_weight: updatedWeight
      }, { transaction: t });

      // ================= STOCK MOVEMENT =================
      await StockMovement.create({
        organization_id: store.id,
        item_id: item.item_id,
        movement_type: "sale",   
        reference_type: "BILL",
        reference_id: bill.id,

        qty: 1,
        weight: item.net_weight,

        opening_available_qty: openingQty,
        closing_available_qty: updatedQty,

        opening_available_weight: openingWeight,
        closing_available_weight: updatedWeight,

        remarks: "Item sold via billing"
      }, { transaction: t });

      // ================= ITEM UPDATE =================
      await Item.update(
        { current_status: "sold" }, 
        {
          where: { id: item.item_id },
          transaction: t
        }
      );
    }

    await t.commit();

    res.status(201).json({
      success: true,
      data: {
        bill_id: bill.id,
        bill_number: bill.bill_number,
        total_amount: Number(grandTotal.toFixed(2))
      }
    });

  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};