import sequelize from "../config/db.js";
import axios from "axios";
import { Op } from "sequelize";

import {
  StockTransfer,
  StockTransferItem,
  Item,
  Stock,
  Store,
  Driver,
  TrackingLog,
} from "../models/index.js";


const getStoreIdFromHeader = async (req) => {
  const store = await Store.findOne({
    where: { store_code: req.headers.store_code },
    attributes: ["id"],
    raw: true,
  });

  if (!store) throw new Error("Store not found");
  return Number(store.id);
};

// ==========================================
//  DASHBOARD
// ==========================================
export const getTransitDashboard = async (req, res) => {
  try {
    const storeId = await getStoreIdFromHeader(req);

    const where = {
      [Op.or]: [
        { from_organization_id: storeId },
        { to_organization_id: storeId },
      ],
    };

    const [inTransit, delivered, total] = await Promise.all([
      StockTransfer.count({ where: { ...where, status: "in_transit" } }),
      StockTransfer.count({ where: { ...where, status: "received" } }),
      StockTransfer.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        in_transit: inTransit,
        shipments: total,
        goods_receipt: delivered,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const getActiveShipments = async (req, res) => {
  try {
    const storeId = await getStoreIdFromHeader(req);

    const transfers = await StockTransfer.findAll({
      where: {
        status: "in_transit",
        from_organization_id: storeId,
      },
      include: [
        {
          model: Driver,
          as: "driver",
          attributes: ["name", "phone", "vehicle_number"],
        },
        {
          model: StockTransferItem,
          as: "items",
          attributes: ["item_id", "qty"],
          include: [
            {
              model: Item,
              as: "item",
              attributes: ["item_name", "category"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const formatted = transfers.map((t) => ({
      id: t.id,
      tracking_no: t.transfer_no,
      status: t.status,

      from: Number(t.from_organization_id),
      to: Number(t.to_organization_id),

      shipped_date: t.transfer_date,
      expected_delivery: new Date(
        new Date(t.transfer_date).getTime() + 3 * 24 * 60 * 60 * 1000
      ),

      driver: t.driver
        ? {
            name: t.driver.name,
            phone: t.driver.phone,
            vehicle: t.driver.vehicle_number,
          }
        : null,

      items: t.items.map((i) => ({
        name: i.item?.item_name,
        qty: Number(i.qty),
      })),
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const getShipmentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const transfer = await StockTransfer.findByPk(id, {
      include: [
        { model: Driver, as: "driver" },
        {
          model: StockTransferItem,
          as: "items",
          attributes: ["item_id", "qty", "weight"],
          include: [
            {
              model: Item,
              as: "item",
              attributes: ["item_name", "category"],
            },
          ],
        },
        {
          model: TrackingLog,
          as: "tracking",
          attributes: ["lat", "lng", "createdAt"],
        },
      ],
    });

    if (!transfer) {
      return res.status(404).json({ error: "Transfer not found" });
    }

   
    const groupedItems = Object.values(
      transfer.items.reduce((acc, item) => {
        const id = item.item_id;

        if (!acc[id]) {
          acc[id] = {
            item_id: id,
            name: item.item?.item_name,
            category: item.item?.category,
            qty: Number(item.qty),
            weight: Number(item.weight || 0),
          };
        } else {
          acc[id].qty += Number(item.qty);
          acc[id].weight += Number(item.weight || 0);
        }

        return acc;
      }, {})
    );

   
    const summary = {
      total_items: groupedItems.length,
      total_qty: groupedItems.reduce((s, i) => s + i.qty, 0),
      total_weight: groupedItems.reduce((s, i) => s + i.weight, 0),
    };

    res.json({
      success: true,
      data: {
        transfer,
        summary,
        items: groupedItems,
        tracking: transfer.tracking,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const markDelivered = async (req, res) => {
  try {
    const { id } = req.params;

    await sequelize.transaction(async (t) => {
      const transfer = await StockTransfer.findByPk(id, { transaction: t });
      if (!transfer) throw new Error("Transfer not found");

      await transfer.update(
        {
          status: "received",
          receive_date: new Date(),
        },
        { transaction: t }
      );

      const items = await StockTransferItem.findAll({
        where: { transfer_id: id },
        transaction: t,
      });

      for (let i of items) {
        const stock = await Stock.findOne({
          where: {
            item_id: i.item_id,
            organization_id: transfer.to_organization_id,
          },
          transaction: t,
        });

        if (stock) {
          stock.available_qty += Number(i.qty);
          await stock.save({ transaction: t });
        } else {
          await Stock.create(
            {
              item_id: i.item_id,
              organization_id: transfer.to_organization_id,
              available_qty: Number(i.qty),
            },
            { transaction: t }
          );
        }
      }
    });

    
    try {
      global.io.emit("delivery-updated", {
        transferId: id,
        status: "received",
      });
    } catch (e) {
      console.log("Socket error:", e.message);
    }

    res.json({ success: true, message: "Marked as Delivered" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const sendLocation = async (req, res) => {
  try {
    const { transferId, lat, lng } = req.body;

    if (!transferId || !lat || !lng) {
      return res.status(400).json({ error: "Missing fields" });
    }

    await TrackingLog.create({
      transfer_id: transferId,
      lat,
      lng,
    });

    global.io
      .to(`transfer_${transferId}`)
      .emit("receive-location", { lat, lng });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const getTrackingHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const logs = await TrackingLog.findAll({
      where: { transfer_id: id },
      order: [["createdAt", "ASC"]],
    });

    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const getRoute = async (req, res) => {
  try {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ error: "Missing origin/destination" });
    }

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin,
          destination,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      }
    );

    const route = response.data.routes[0];

    res.json({
      success: true,
      data: {
        distance: route.legs[0].distance,
        duration: route.legs[0].duration,
        polyline: route.overview_polyline.points,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};