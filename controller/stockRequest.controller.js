import sequelize from "../config/db.js";
import { Op } from "sequelize";
import Store from "../model/Store.js"
import StockTransfer from "../model/stockTransfer.js";
import StockTransferItem from "../model/stockTransferItem.js";
import Stock from "../model/stockrecord.js";
import StockMovement from "../model/stockmovement.js";
import ActivityLog from "../model/activityLog.js";
import Item from "../model/item.js";
import StockRequest from "../model/StockRequest.js";
import StockRequestItem from "../model/stockRequestItem.js";
import District from "../model/District.js";
const generateTransferNo = () => {
  return `TRF-${Date.now()}`;
};

const generateRequestNo = () => {
  return `REQ-${Date.now()}`;
};

const toNumber = (val) => Number(val || 0);

const getOrCreateStock = async (organization_id, item_id, transaction) => {
  let stock = await Stock.findOne({
    where: { organization_id, item_id },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!stock) {
    stock = await Stock.create(
      {
        organization_id,
        item_id,
        available_qty: 0,
        available_weight: 0,
        reserved_qty: 0,
        reserved_weight: 0,
        transit_qty: 0,
        transit_weight: 0,
        damaged_qty: 0,
        damaged_weight: 0,
      },
      { transaction }
    );
  }

  return stock;
};

const createMovement = async ({
  organization_id,
  item_id,
  movement_type,
  reference_type,
  reference_id,
  qty = 0,
  weight = 0,
  stockBefore,
  stockAfter,
  remarks = null,
  created_by = null,
  transaction,
}) => {
  await StockMovement.create(
    {
      organization_id,
      item_id,
      movement_type,
      reference_type,
      reference_id,
      qty,
      weight,

      opening_available_qty: toNumber(stockBefore.available_qty),
      closing_available_qty: toNumber(stockAfter.available_qty),

      opening_reserved_qty: toNumber(stockBefore.reserved_qty),
      closing_reserved_qty: toNumber(stockAfter.reserved_qty),

      opening_transit_qty: toNumber(stockBefore.transit_qty),
      closing_transit_qty: toNumber(stockAfter.transit_qty),

      opening_damaged_qty: toNumber(stockBefore.damaged_qty),
      closing_damaged_qty: toNumber(stockAfter.damaged_qty),

      opening_available_weight: toNumber(stockBefore.available_weight),
      closing_available_weight: toNumber(stockAfter.available_weight),

      opening_reserved_weight: toNumber(stockBefore.reserved_weight),
      closing_reserved_weight: toNumber(stockAfter.reserved_weight),

      opening_transit_weight: toNumber(stockBefore.transit_weight),
      closing_transit_weight: toNumber(stockAfter.transit_weight),

      opening_damaged_weight: toNumber(stockBefore.damaged_weight),
      closing_damaged_weight: toNumber(stockAfter.damaged_weight),

      remarks,
      created_by,
    },
    { transaction }
  );
};

const createActivity = async ({
  user_id,
  action,
  title,
  description,
  meta = {},
  transaction,
}) => {
  await ActivityLog.create(
    {
      user_id,
      action,
      title,
      description,
      meta,
      icon: "activity",
      color: "blue",
    },
    { transaction }
  );
};

export const getAvailableStockForRequest = async (req, res) => {
  try {
    const user = req.user;
    const { category, search, metal_type } = req.query;

    if (!user?.organization_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    const orgId = Number(user.organization_id);

    const itemWhere = {
      organization_id: orgId,
      current_status: "in_stock",
    };

    const stockWhere = {
      organization_id: orgId,
      available_qty: {
        [Op.gt]: 0,
      },
    };

    if (category) {
      itemWhere.category = category;
    }

    if (metal_type) {
      itemWhere.metal_type = metal_type;
    }

    if (search) {
      itemWhere[Op.or] = [
        { item_name: { [Op.iLike]: `%${search}%` } },
        { article_code: { [Op.iLike]: `%${search}%` } },
        { sku_code: { [Op.iLike]: `%${search}%` } },
        { purity: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const items = await Item.findAll({
      attributes: [
        "id",
        "item_name",
        "article_code",
        "sku_code",
        "metal_type",
        "category",
        "purity",
        "unit",
        "organization_id",
      ],
      where: itemWhere,
      include: [
        {
          model: Stock,
          as: "stocks",
          required: true,
          where: stockWhere,
          attributes: [
            "id",
            "item_id",
            "organization_id",
            "available_qty",
            "available_weight",
          ],
        },
      ],
      order: [["id", "DESC"]],
    });

    const data = items.map((item) => {
      const stock =
        Array.isArray(item.stocks) && item.stocks.length > 0
          ? item.stocks[0]
          : null;

      const availableQty = Number(stock?.available_qty || 0);

      let statusLabel = "medium";
      if (availableQty <= 2) {
        statusLabel = "critical";
      } else if (availableQty <= 12) {
        statusLabel = "medium";
      } else {
        statusLabel = "optimum";
      }

      return {
        item_id: Number(item.id),
        item_name: item.item_name || "",
        article_code: item.article_code || "",
        sku_code: item.sku_code || "",
        category: item.category || "",
        metal_type: item.metal_type || "",
        purity: item.purity || "",
        unit: item.unit || "",
        available_qty: availableQty,
        available_weight: Number(stock?.available_weight || 0),
        status_label: statusLabel,
        request_qty: 0,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Available stock fetched successfully",
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getAvailableStockForRequest error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch available stock items",
      error: error.message,
    });
  }
};
// helper



export const createStockRequest = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const user = req.user;
    const { store_id, items, priority, category, notes } = req.body;

    if (!store_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request"
      });
    }

    // ================= STORE =================
    const store = await Store.findOne({
      where: { id: store_id },
      transaction
    });

    if (!store) {
      await transaction.rollback();
      return res.status(404).json({ message: "Store not found" });
    }

    // ================= DISTRICT =================
    const district = await District.findOne({
      where: { id: store.district_id },
      transaction
    });

    if (!district) {
      await transaction.rollback();
      return res.status(404).json({ message: "District not found" });
    }

    // ================= SAFE MAPPING (FIXED) =================
    const from_organization_id = user.organization_id;

    // 🔥 FIX: NEVER NULL SAFE
    const to_organization_id =
      store.organization_id ||
      user.organization_id;

    const to_district_code = String(
      district.district_id || store.district_id || "0"
    );

    const to_district_name =
      district.district || store.district || "Unknown";

    // ================= CREATE REQUEST =================
    const stockRequest = await StockRequest.create(
      {
        request_no: `REQ-${Date.now()}`,

        from_organization_id,
        from_store_code: store.store_code,
        from_store_name: store.store_name,

        to_organization_id,
        to_district_code,
        to_district_name,

        priority: priority || "medium",
        category,
        notes,
        status: "pending",
        created_by: user.id,
      },
      { transaction }
    );

    // ================= ITEMS (FIXED SAFETY) =================
    const requestItems = items
      .filter(i => i.item_id && Number(i.request_qty) > 0)
      .map(i => ({
        request_id: stockRequest.id,
        item_id: i.item_id,
        request_qty: Number(i.request_qty),
        approved_qty: 0,
        status: "pending"
      }));

    if (requestItems.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No valid items found"
      });
    }

    await StockRequestItem.bulkCreate(requestItems, { transaction });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Stock request created successfully",
      request_id: stockRequest.id
    });

  } catch (error) {
    await transaction.rollback();
    console.error("createStockRequest error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
// ==========================================
// STORE -> MY REQUESTS 
// ==========================================
export const getMyStockRequests = async (req, res) => {
  try {
    const user = req.user;

    const requests = await StockRequest.findAll({
      where: {
        from_organization_id: user.organization_id,
      },
      include: [
        {
          model: StockRequestItem,
          as: "request_items",
        },
        {
          model: StockTransfer,
          as: "transfer",
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch my stock requests",
      error: error.message,
    });
  }
};



// ==========================================
// DISTRICT / PARENT -> RECEIVED REQUESTS
// ==========================================
export const getReceivedStockRequests = async (req, res) => {
  try {
    const user = req.user;

    const requests = await StockRequest.findAll({
      where: {
        to_organization_id: user.organization_id,
      },
      include: [
        {
          model: StockRequestItem,
          as: "request_items",
        },
        {
          model: StockTransfer,
          as: "transfer",
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch received stock requests",
      error: error.message,
    });
  }
};



// ==========================================
// GET SINGLE REQUEST
// ==========================================
export const getStockRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    const user = req.user;

    const request = await StockRequest.findByPk(requestId, {
      include: [
        {
          model: StockRequestItem,
          as: "request_items",
        },
        {
          model: StockTransfer,
          as: "transfer",
          include: [
            {
              model: StockTransferItem,
              as: "items",
            },
          ],
        },
      ],
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Stock request not found",
      });
    }

    const allowed =
      Number(request.from_organization_id) === Number(user.organization_id) ||
      Number(request.to_organization_id) === Number(user.organization_id);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this request",
      });
    }

    return res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock request details",
      error: error.message,
    });
  }
};



// ==========================================
// STORE -> CANCEL PENDING REQUEST
// ==========================================
export const cancelStockRequest = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { requestId } = req.params;
    const user = req.user;

    const request = await StockRequest.findByPk(requestId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Stock request not found",
      });
    }

    if (Number(request.from_organization_id) !== Number(user.organization_id)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not allowed to cancel this request",
      });
    }

    if (request.status !== "pending") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Only pending request can be cancelled",
      });
    }

    await request.update(
      {
        status: "cancelled",
      },
      { transaction }
    );

    await createActivity({
      user_id: user.id,
      action: "stock_request_cancelled",
      title: "Stock request cancelled",
      description: `Stock request ${request.request_no} cancelled`,
      meta: {
        request_id: request.id,
        request_no: request.request_no,
      },
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Stock request cancelled successfully",
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: "Failed to cancel stock request",
      error: error.message,
    });
  }
};



// ==========================================
// PARENT ORG -> REJECT REQUEST
// ==========================================
export const rejectStockRequest = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { requestId } = req.params;
    const { remarks } = req.body;
    const user = req.user;

    const request = await StockRequest.findByPk(requestId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Stock request not found",
      });
    }

    if (Number(request.to_organization_id) !== Number(user.organization_id)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not allowed to reject this request",
      });
    }

    if (request.status !== "pending") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Only pending request can be rejected",
      });
    }

    await request.update(
      {
        status: "rejected",
        remarks: remarks || request.remarks,
      },
      { transaction }
    );

    await createActivity({
      user_id: user.id,
      action: "stock_request_rejected",
      title: "Stock request rejected",
      description: `Stock request ${request.request_no} rejected`,
      meta: {
        request_id: request.id,
        request_no: request.request_no,
      },
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Stock request rejected successfully",
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: "Failed to reject stock request",
      error: error.message,
    });
  }
};



// ==========================================
// PARENT ORG -> APPROVE & DISPATCH
// ==========================================
export const approveAndDispatchRequest = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { requestId } = req.params;
    const { items, remarks } = req.body;
    const user = req.user;

    if (!Array.isArray(items) || !items.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Approved items are required",
      });
    }

    const request = await StockRequest.findByPk(requestId, {
      include: [
        {
          model: StockRequestItem,
          as: "request_items",
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!request) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Stock request not found",
      });
    }

    if (Number(request.to_organization_id) !== Number(user.organization_id)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not allowed to approve this request",
      });
    }

    if (request.status !== "pending") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Only pending request can be approved",
      });
    }

    const existingTransfer = await StockTransfer.findOne({
      where: { request_id: request.id },
      transaction,
    });

    if (existingTransfer) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Transfer already created for this request",
      });
    }

    const transfer = await StockTransfer.create(
      {
        transfer_no: generateTransferNo(),
        request_id: request.id,
        from_organization_id: user.organization_id,
        to_organization_id: request.from_organization_id,
        transfer_date: new Date(),
        dispatch_date: new Date(),
        status: "in_transit",
        approved_by: user.id,
        dispatched_by: user.id,
        created_by: user.id,
        remarks: remarks || null,
      },
      { transaction }
    );

    let totalRequested = 0;
    let totalApproved = 0;

    for (const row of items) {
      const item_id = Number(row.item_id);
      const qty = toNumber(row.qty);
      const weight = toNumber(row.weight);
      const rate = toNumber(row.rate);

      if (!item_id || qty <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Each item must have valid item_id and qty",
        });
      }

      const requestItem = request.request_items.find(
        (x) => Number(x.item_id) === item_id
      );

      if (!requestItem) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Requested item not found for item_id ${item_id}`,
        });
      }

      if (qty > toNumber(requestItem.qty)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Approved qty cannot exceed requested qty for item ${item_id}`,
        });
      }

      totalRequested += toNumber(requestItem.qty);
      totalApproved += qty;

      const fromStock = await getOrCreateStock(
        user.organization_id,
        item_id,
        transaction
      );

      const before = {
        available_qty: fromStock.available_qty,
        reserved_qty: fromStock.reserved_qty,
        transit_qty: fromStock.transit_qty,
        damaged_qty: fromStock.damaged_qty,
        available_weight: fromStock.available_weight,
        reserved_weight: fromStock.reserved_weight,
        transit_weight: fromStock.transit_weight,
        damaged_weight: fromStock.damaged_weight,
      };

      if (toNumber(fromStock.available_qty) < qty) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient available qty for item ${item_id}`,
        });
      }

      if (weight > 0 && toNumber(fromStock.available_weight) < weight) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient available weight for item ${item_id}`,
        });
      }

      await StockTransferItem.create(
        {
          transfer_id: transfer.id,
          item_id,
          qty,
          weight,
          rate,
          remarks: row.remarks || null,
        },
        { transaction }
      );

      await requestItem.update(
        {
          approved_qty: qty,
          approved_weight: weight,
        },
        { transaction }
      );

      await fromStock.update(
        {
          available_qty: toNumber(fromStock.available_qty) - qty,
          available_weight: toNumber(fromStock.available_weight) - weight,
          transit_qty: toNumber(fromStock.transit_qty) + qty,
          transit_weight: toNumber(fromStock.transit_weight) + weight,
        },
        { transaction }
      );

      const after = {
        available_qty: fromStock.available_qty,
        reserved_qty: fromStock.reserved_qty,
        transit_qty: fromStock.transit_qty,
        damaged_qty: fromStock.damaged_qty,
        available_weight: fromStock.available_weight,
        reserved_weight: fromStock.reserved_weight,
        transit_weight: fromStock.transit_weight,
        damaged_weight: fromStock.damaged_weight,
      };

      await createMovement({
        organization_id: user.organization_id,
        item_id,
        movement_type: "dispatch",
        reference_type: "stock_transfer",
        reference_id: transfer.id,
        qty,
        weight,
        stockBefore: before,
        stockAfter: after,
        remarks: `Dispatched via ${transfer.transfer_no}`,
        created_by: user.id,
        transaction,
      });
    }

    const finalStatus =
      totalApproved < totalRequested ? "partially_approved" : "approved";

    await request.update(
      {
        status: finalStatus,
      },
      { transaction }
    );

    await createActivity({
      user_id: user.id,
      action: "stock_request_approved_dispatch",
      title: "Stock request approved and dispatched",
      description: `Request approved and transfer ${transfer.transfer_no} created`,
      meta: {
        request_id: request.id,
        transfer_id: transfer.id,
        transfer_no: transfer.transfer_no,
      },
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Request approved and stock dispatched successfully",
      data: transfer,
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: "Failed to approve and dispatch request",
      error: error.message,
    });
  }
};



// ==========================================
// STORE -> RECEIVE TRANSFER
// ==========================================
export const receiveTransfer = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { transferId } = req.params;
    const { remarks } = req.body;
    const user = req.user;

    const transfer = await StockTransfer.findByPk(transferId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!transfer) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Transfer not found",
      });
    }

    if (Number(transfer.to_organization_id) !== Number(user.organization_id)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "You are not allowed to receive this transfer",
      });
    }

    if (transfer.status !== "in_transit") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Only in_transit transfer can be received",
      });
    }

    const transferItems = await StockTransferItem.findAll({
      where: { transfer_id: transfer.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    for (const trItem of transferItems) {
      const item_id = Number(trItem.item_id);
      const qty = toNumber(trItem.qty);
      const weight = toNumber(trItem.weight);

      const sourceStock = await getOrCreateStock(
        transfer.from_organization_id,
        item_id,
        transaction
      );

      const sourceBefore = {
        available_qty: sourceStock.available_qty,
        reserved_qty: sourceStock.reserved_qty,
        transit_qty: sourceStock.transit_qty,
        damaged_qty: sourceStock.damaged_qty,
        available_weight: sourceStock.available_weight,
        reserved_weight: sourceStock.reserved_weight,
        transit_weight: sourceStock.transit_weight,
        damaged_weight: sourceStock.damaged_weight,
      };

      await sourceStock.update(
        {
          transit_qty: Math.max(0, toNumber(sourceStock.transit_qty) - qty),
          transit_weight: Math.max(0, toNumber(sourceStock.transit_weight) - weight),
        },
        { transaction }
      );

      const sourceAfter = {
        available_qty: sourceStock.available_qty,
        reserved_qty: sourceStock.reserved_qty,
        transit_qty: sourceStock.transit_qty,
        damaged_qty: sourceStock.damaged_qty,
        available_weight: sourceStock.available_weight,
        reserved_weight: sourceStock.reserved_weight,
        transit_weight: sourceStock.transit_weight,
        damaged_weight: sourceStock.damaged_weight,
      };

      await createMovement({
        organization_id: transfer.from_organization_id,
        item_id,
        movement_type: "dispatch",
        reference_type: "stock_transfer_transit_clear",
        reference_id: transfer.id,
        qty: 0,
        weight: 0,
        stockBefore: sourceBefore,
        stockAfter: sourceAfter,
        remarks: `Transit cleared after receive for ${transfer.transfer_no}`,
        created_by: user.id,
        transaction,
      });

      const destinationStock = await getOrCreateStock(
        transfer.to_organization_id,
        item_id,
        transaction
      );

      const destinationBefore = {
        available_qty: destinationStock.available_qty,
        reserved_qty: destinationStock.reserved_qty,
        transit_qty: destinationStock.transit_qty,
        damaged_qty: destinationStock.damaged_qty,
        available_weight: destinationStock.available_weight,
        reserved_weight: destinationStock.reserved_weight,
        transit_weight: destinationStock.transit_weight,
        damaged_weight: destinationStock.damaged_weight,
      };

      await destinationStock.update(
        {
          available_qty: toNumber(destinationStock.available_qty) + qty,
          available_weight: toNumber(destinationStock.available_weight) + weight,
        },
        { transaction }
      );

      const destinationAfter = {
        available_qty: destinationStock.available_qty,
        reserved_qty: destinationStock.reserved_qty,
        transit_qty: destinationStock.transit_qty,
        damaged_qty: destinationStock.damaged_qty,
        available_weight: destinationStock.available_weight,
        reserved_weight: destinationStock.reserved_weight,
        transit_weight: destinationStock.transit_weight,
        damaged_weight: destinationStock.damaged_weight,
      };

      await createMovement({
        organization_id: transfer.to_organization_id,
        item_id,
        movement_type: "receive",
        reference_type: "stock_transfer",
        reference_id: transfer.id,
        qty,
        weight,
        stockBefore: destinationBefore,
        stockAfter: destinationAfter,
        remarks: `Received via ${transfer.transfer_no}`,
        created_by: user.id,
        transaction,
      });
    }

    await transfer.update(
      {
        receive_date: new Date(),
        status: "received",
        received_by: user.id,
        remarks: remarks || transfer.remarks,
      },
      { transaction }
    );

    if (transfer.request_id) {
      const request = await StockRequest.findByPk(transfer.request_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (request) {
        await request.update(
          {
            status: "completed",
          },
          { transaction }
        );
      }
    }

    await createActivity({
      user_id: user.id,
      action: "stock_transfer_received",
      title: "Stock transfer received",
      description: `Transfer ${transfer.transfer_no} received successfully`,
      meta: {
        transfer_id: transfer.id,
        transfer_no: transfer.transfer_no,
      },
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Stock received successfully",
      data: transfer,
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: "Failed to receive transfer",
      error: error.message,
    });
  }
};



// ==========================================
// INCOMING TRANSFERS
// ==========================================
export const getIncomingTransfers = async (req, res) => {
  try {
    const user = req.user;

    const transfers = await StockTransfer.findAll({
      where: {
        to_organization_id: user.organization_id,
        status: {
          [Op.in]: ["approved", "dispatched", "in_transit", "received"],
        },
      },
      include: [
        {
          model: StockTransferItem,
          as: "items",
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      count: transfers.length,
      data: transfers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch incoming transfers",
      error: error.message,
    });
  }
};



// ==========================================
// OUTGOING TRANSFERS
// ==========================================
export const getOutgoingTransfers = async (req, res) => {
  try {
    const user = req.user;

    const transfers = await StockTransfer.findAll({
      where: {
        from_organization_id: user.organization_id,
      },
      include: [
        {
          model: StockTransferItem,
          as: "items",
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      count: transfers.length,
      data: transfers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch outgoing transfers",
      error: error.message,
    });
  }
};