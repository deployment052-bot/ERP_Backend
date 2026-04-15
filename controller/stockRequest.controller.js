import fs from "fs";
import sequelize from "../config/db.js";
import { Op } from "sequelize";
import Store from "../model/Store.js";
import StockTransfer from "../model/stockTransfer.js";
import StockTransferItem from "../model/stockTransferItem.js";
import Stock from "../model/stockrecord.js";
import StockMovement from "../model/stockmovement.js";
import ActivityLog from "../model/activityLog.js";
import SystemActivity from "../model/systemActivity.js";
import Item from "../model/item.js";
import Task from "../model/task.js";
import StockRequest from "../model/StockRequest.js";
import StockRequestItem from "../model/stockRequestItem.js";
import District from "../model/District.js";
import cloudinary from "../utils/cloudinary.js";

const generateTransferNo = () => {
  return `TRF-${Date.now()}`;
};

const generateRequestNo = () => {
  return `REQ-${Date.now()}`;
};

const toNumber = (val) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
};

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

const safeUnlink = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("File delete error:", error.message);
  }
};

const uploadToCloudinary = async (filePath, folder, resourceType = "image") => {
  return cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: resourceType,
  });
};

const tryJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const normalizeItemRow = (row = {}) => {
  return {
    item_id: toNumber(row.item_id ?? row.id ?? row.itemId),
    qty: toNumber(row.qty ?? row.approved_qty ?? row.approve_qty ?? row.quantity),
    weight: toNumber(row.weight ?? row.approved_weight ?? row.total_weight),
    rate: toNumber(row.rate ?? row.item_rate ?? row.price),
    remarks: row.remarks || row.note || null,
  };
};

const parseItemsFromBody = (body) => {
  // 1) direct array
  if (Array.isArray(body.items)) {
    return body.items.map(normalizeItemRow);
  }

  if (Array.isArray(body.approved_items)) {
    return body.approved_items.map(normalizeItemRow);
  }

  // 2) JSON string in items / approved_items
  if (typeof body.items === "string" && body.items.trim()) {
    const parsed = tryJsonParse(body.items);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeItemRow);
    }
  }

  if (typeof body.approved_items === "string" && body.approved_items.trim()) {
    const parsed = tryJsonParse(body.approved_items);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeItemRow);
    }
  }

  // 3) multipart style: items[0][item_id] OR items[0].item_id
  const grouped = {};

  for (const [key, value] of Object.entries(body)) {
    let match = key.match(/^items\[(\d+)\]\[(\w+)\]$/);
    if (!match) {
      match = key.match(/^items\[(\d+)\]\.(\w+)$/);
    }
    if (!match) {
      match = key.match(/^approved_items\[(\d+)\]\[(\w+)\]$/);
    }
    if (!match) {
      match = key.match(/^approved_items\[(\d+)\]\.(\w+)$/);
    }

    if (match) {
      const index = Number(match[1]);
      const field = match[2];

      if (!grouped[index]) {
        grouped[index] = {};
      }
      grouped[index][field] = value;
    }
  }

  const result = Object.keys(grouped)
    .sort((a, b) => Number(a) - Number(b))
    .map((idx) => normalizeItemRow(grouped[idx]))
    .filter((row) => row.item_id);

  if (result.length > 0) {
    return result;
  }

  return [];
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
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "store_id and items are required",
      });
    }

    const store = await Store.findOne({
      where: { id: store_id },
      transaction,
    });

    if (!store) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    const district = await District.findOne({
      where: { id: store.district_id },
      transaction,
    });

    if (!district) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "District not found",
      });
    }

    const validItems = items
      .filter((i) => i.item_id && Number(i.request_qty) > 0)
      .map((i) => ({
        item_id: Number(i.item_id),
        request_qty: Number(i.request_qty),
        approved_qty: 0,
        status: "pending",
      }));

    if (validItems.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No valid items found",
      });
    }

    const request_no = `REQ-${user.organization_id}-${Date.now()}`;

    const districtName =
      district.name || district.district || district.district_name || "Unknown";

    const stockRequest = await StockRequest.create(
      {
        request_no,
        from_organization_id: user.organization_id,
        from_store_code: store.store_code,
        from_store_name: store.store_name,
        to_organization_id: district.id,
        to_district_code: String(district.id),
        to_district_name: districtName,
        priority: priority || "medium",
        category: category || null,
        notes: notes || null,
        status: "pending",
        created_by: user.id,
      },
      { transaction }
    );

    const requestItemsPayload = validItems.map((item) => ({
      request_id: stockRequest.id,
      item_id: item.item_id,
      request_qty: item.request_qty,
      approved_qty: item.approved_qty,
      status: item.status,
    }));

    await StockRequestItem.bulkCreate(requestItemsPayload, { transaction });

    // ================= TASK CREATE =================
    await Task.create(
      {
        title: "Stock request approval required",
        description: `${store.store_name} submitted stock request ${stockRequest.request_no} for district ${districtName}`,
        priority: priority || "medium",
        status: "pending",
        task_type: "stock_request_approval",
        reference_id: stockRequest.id,
        reference_no: stockRequest.request_no,
        district_code: String(district.id),
        store_code: store.store_code || null,
        store_name: store.store_name || null,
        assigned_to: null, // district manager user id later if needed
        created_by: user.id,
      },
      { transaction }
    );

    // ================= RECENT / SYSTEM ACTIVITY =================
    await SystemActivity.create(
      {
        title: "New stock request submitted",
        description: `${store.store_name} submitted request ${stockRequest.request_no} to district ${districtName}`,
        activity_type: "stock_request_created",
        module_name: "stock_request",
        reference_id: stockRequest.id,
        reference_no: stockRequest.request_no,
        district_code: String(district.id),
        store_code: store.store_code || null,
        store_name: store.store_name || null,
        created_by: user.id,
        created_at: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Stock request created successfully",
      data: {
        request_id: stockRequest.id,
        request_no: stockRequest.request_no,
        total_items: requestItemsPayload.length,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("createStockRequest error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
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
          include: [
            {
              model: Item,
              as: "item",
              attributes: [
                "id",
                "item_name",
                "article_code",
                "sku_code",
                "category",
                "metal_type",
                "purity",
                "unit",
                "gross_weight",
                "net_weight",
              ],
              required: false,
            },
          ],
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
    console.error("getReceivedStockRequests error:", error);
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
              as: "transfer_items",
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
    console.error("getStockRequestById error:", error);

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
  const uploadedLocalPaths = [];

  try {
    const { requestId } = req.params;
    const {
      remarks,
      driver_name,
      driver_phone,
      vehicle_number,
      tracking_number,
      pickup_address,
      delivery_address,
      expected_delivery_date,
      expected_delivery_time,
      additional_notes,
    } = req.body;

    const user = req.user;
    const parsedItems = parseItemsFromBody(req.body);

    console.log("approveAndDispatchRequest req.body keys:", Object.keys(req.body || {}));
    console.log("approveAndDispatchRequest raw items:", req.body?.items);
    console.log("approveAndDispatchRequest parsedItems:", parsedItems);
    console.log("approveAndDispatchRequest files:", {
      driver_photo: req.files?.driver_photo?.length || 0,
      dispatch_images: req.files?.dispatch_images?.length || 0,
      dispatch_video: req.files?.dispatch_video?.length || 0,
    });

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Approved items are required. Send items as JSON string or items[0][item_id], items[0][qty] format.",
      });
    }

    if (!driver_name || !driver_phone || !vehicle_number) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Driver name, driver phone, and vehicle number are required",
      });
    }

    if (!pickup_address || !delivery_address) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Pickup and delivery address are required",
      });
    }

    if (!expected_delivery_date || !expected_delivery_time) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Expected delivery date and time are required",
      });
    }

    const driverPhotoFile = req.files?.driver_photo?.[0] || null;
    const dispatchImageFiles = req.files?.dispatch_images || [];
    const dispatchVideoFile = req.files?.dispatch_video?.[0] || null;

    if (dispatchImageFiles.length > 3) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Maximum 3 dispatch images allowed",
      });
    }

    if (driverPhotoFile?.path) uploadedLocalPaths.push(driverPhotoFile.path);
    for (const file of dispatchImageFiles) {
      if (file?.path) uploadedLocalPaths.push(file.path);
    }
    if (dispatchVideoFile?.path) uploadedLocalPaths.push(dispatchVideoFile.path);

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

    const requestItems = await StockRequestItem.findAll({
      where: { request_id: request.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

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
      lock: transaction.LOCK.UPDATE,
    });

    if (existingTransfer) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Transfer already created for this request",
      });
    }

    const requestItemMap = new Map(
      requestItems.map((x) => [Number(x.item_id), x])
    );

    for (const row of parsedItems) {
      const item_id = toNumber(row.item_id);
      const qty = toNumber(row.qty);

      if (!item_id || qty < 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Each item must have valid item_id and qty",
        });
      }

      const requestItem = requestItemMap.get(item_id);

      if (!requestItem) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Requested item not found for item_id ${item_id}`,
        });
      }

      const requestedQty = toNumber(requestItem.request_qty);

      if (qty > requestedQty) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Approved qty cannot exceed requested qty for item ${item_id}`,
        });
      }
    }

    let driver_photo_url = null;
    let dispatch_image_urls = [];
    let dispatch_video_url = null;

    if (driverPhotoFile?.path) {
      const uploadedDriverPhoto = await uploadToCloudinary(
        driverPhotoFile.path,
        "stock-transfer/driver-photo",
        "image"
      );
      driver_photo_url = uploadedDriverPhoto.secure_url;
    }

    if (dispatchImageFiles.length > 0) {
      for (const file of dispatchImageFiles) {
        const uploadedImage = await uploadToCloudinary(
          file.path,
          "stock-transfer/dispatch-images",
          "image"
        );
        dispatch_image_urls.push(uploadedImage.secure_url);
      }
    }

    if (dispatchVideoFile?.path) {
      const uploadedVideo = await uploadToCloudinary(
        dispatchVideoFile.path,
        "stock-transfer/dispatch-video",
        "video"
      );
      dispatch_video_url = uploadedVideo.secure_url;
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
        driver_name: driver_name || null,
        driver_phone: driver_phone || null,
        vehicle_number: vehicle_number || null,
        tracking_number: tracking_number || null,
        driver_photo_url: driver_photo_url || null,
        dispatch_image_url:
          dispatch_image_urls.length > 0
            ? JSON.stringify(dispatch_image_urls)
            : null,
        dispatch_video_url: dispatch_video_url || null,
        pickup_address: pickup_address || null,
        delivery_address: delivery_address || null,
        expected_delivery_date: expected_delivery_date || null,
        expected_delivery_time: expected_delivery_time || null,
        additional_notes: additional_notes || null,
      },
      { transaction }
    );

    let totalRequested = 0;
    let totalApproved = 0;
    let totalWeight = 0;
    let estimatedValue = 0;
    let approvedItemsCount = 0;

    for (const row of parsedItems) {
      const item_id = toNumber(row.item_id);
      const qty = toNumber(row.qty);
      const weight = toNumber(row.weight);
      const rate = toNumber(row.rate);

      const requestItem = requestItemMap.get(item_id);
      const requestedQty = toNumber(requestItem.request_qty);

      totalRequested += requestedQty;
      totalApproved += qty;

      if (qty === 0) {
        await requestItem.update(
          {
            approved_qty: 0,
            approved_weight: 0,
            status: "rejected",
          },
          { transaction }
        );
        continue;
      }

      approvedItemsCount += 1;
      totalWeight += weight;
      estimatedValue += weight * rate;

      const fromStock = await getOrCreateStock(
        user.organization_id,
        item_id,
        transaction
      );

      const availableQty = toNumber(fromStock.available_qty);
      const availableWeight = toNumber(fromStock.available_weight);
      const reservedQty = toNumber(fromStock.reserved_qty);
      const reservedWeight = toNumber(fromStock.reserved_weight);
      const transitQty = toNumber(fromStock.transit_qty);
      const transitWeight = toNumber(fromStock.transit_weight);
      const damagedQty = toNumber(fromStock.damaged_qty);
      const damagedWeight = toNumber(fromStock.damaged_weight);

      if (availableQty < qty) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient available qty for item ${item_id}`,
        });
      }

      if (weight > 0 && availableWeight < weight) {
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
          status: qty < requestedQty ? "partially_approved" : "approved",
        },
        { transaction }
      );

      const newAvailableQty = availableQty - qty;
      const newAvailableWeight = availableWeight - weight;
      const newTransitQty = transitQty + qty;
      const newTransitWeight = transitWeight + weight;

      await fromStock.update(
        {
          available_qty: newAvailableQty,
          available_weight: newAvailableWeight,
          transit_qty: newTransitQty,
          transit_weight: newTransitWeight,
        },
        { transaction }
      );

      await createMovement({
        organization_id: user.organization_id,
        item_id,
        movement_type: "dispatch",
        reference_type: "stock_transfer",
        reference_id: transfer.id,
        qty,
        weight,
        stockBefore: {
          available_qty: availableQty,
          reserved_qty: reservedQty,
          transit_qty: transitQty,
          damaged_qty: damagedQty,
          available_weight: availableWeight,
          reserved_weight: reservedWeight,
          transit_weight: transitWeight,
          damaged_weight: damagedWeight,
        },
        stockAfter: {
          available_qty: newAvailableQty,
          reserved_qty: reservedQty,
          transit_qty: newTransitQty,
          damaged_qty: damagedQty,
          available_weight: newAvailableWeight,
          reserved_weight: reservedWeight,
          transit_weight: newTransitWeight,
          damaged_weight: damagedWeight,
        },
        remarks: `Dispatched via ${transfer.transfer_no}`,
        created_by: user.id,
        transaction,
      });
    }

    let finalStatus = "approved";
    if (approvedItemsCount === 0) {
      finalStatus = "rejected";
    } else if (totalApproved < totalRequested) {
      finalStatus = "partially_approved";
    }

    await request.update(
      {
        status: finalStatus,
        approved_by: user.id,
        approved_at: new Date(),
      },
      { transaction }
    );

    await Task.update(
      { status: finalStatus },
      {
        where: {
          task_type: "stock_request_approval",
          reference_id: request.id,
        },
        transaction,
      }
    );

    await SystemActivity.create(
      {
        title:
          finalStatus === "approved"
            ? "Stock request approved and dispatched"
            : finalStatus === "partially_approved"
            ? "Stock request partially approved and dispatched"
            : "Stock request rejected",
        description:
          finalStatus === "rejected"
            ? `Request ${request.request_no} was rejected by receiving organization`
            : `Request ${request.request_no} processed via ${transfer.transfer_no}`,
        activity_type: "stock_request_dispatch",
        module_name: "stock_transfer",
        reference_id: transfer.id,
        reference_no: transfer.transfer_no,
        district_code: request.to_district_code || null,
        store_code: request.from_store_code || null,
        store_name: request.from_store_name || null,
        created_by: user.id,
        created_at: new Date(),
      },
      { transaction }
    );

    await createActivity({
      user_id: user.id,
      action: "stock_request_dispatch",
      title:
        finalStatus === "approved"
          ? "Stock request approved and dispatched"
          : finalStatus === "partially_approved"
          ? "Stock request partially approved and dispatched"
          : "Stock request rejected",
      description:
        finalStatus === "rejected"
          ? `Request ${request.request_no} rejected`
          : `Request ${request.request_no} dispatched via ${transfer.transfer_no}`,
      meta: {
        request_id: request.id,
        request_no: request.request_no,
        transfer_id: transfer.id,
        transfer_no: transfer.transfer_no,
        final_status: finalStatus,
        driver_photo_url,
        dispatch_image_urls,
        dispatch_video_url,
      },
      transaction,
    });

    await transaction.commit();

    for (const filePath of uploadedLocalPaths) {
      safeUnlink(filePath);
    }

    return res.status(200).json({
      success: true,
      message:
        finalStatus === "rejected"
          ? "Request rejected successfully"
          : "Request approved and stock dispatched successfully",
      data: {
        transfer: {
          ...transfer.toJSON(),
          dispatch_image_url: dispatch_image_urls,
        },
        uploaded_files: {
          driver_photo_url,
          dispatch_image_urls,
          dispatch_video_url,
        },
        summary: {
          request_id: request.id,
          request_no: request.request_no,
          total_requested: totalRequested,
          total_approved: totalApproved,
          total_weight: totalWeight,
          estimated_value: estimatedValue,
          final_status: finalStatus,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();

    for (const filePath of uploadedLocalPaths) {
      safeUnlink(filePath);
    }

    console.error("approveAndDispatchRequest error:", error);

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