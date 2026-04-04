import { Op } from "sequelize";
import sequelize from "../config/db.js";
import Item from "../models/Item.js";
import StockMovement from "../models/StockMovement.js";
import { createActivityLog } from "../services/activity.service.js";

export const getStockList = async (req, res) => {
  try {
    const user = req.user;
    const { metal_type, category, status, search } = req.query;

    const where = {};

    if (user?.role !== "super_admin") {
      where.branch_id = user?.branch_id;
    }

    if (metal_type) where.metal_type = metal_type;
    if (category) where.category = category;
    if (status) where.current_status = status;

    if (search) {
      where[Op.or] = [
        { item_name: { [Op.iLike]: `%${search}%` } },
        { article_code: { [Op.iLike]: `%${search}%` } },
        { sku_code: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const items = await Item.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Stock list fetched successfully",
      count: items.length,
      data: items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock list",
      error: error.message,
    });
  }
};

export const getSingleStock = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const where = { id };

    if (user?.role !== "super_admin") {
      where.branch_id = user?.branch_id;
    }

    const item = await Item.findOne({ where });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Stock item not found",
      });
    }

    const movements = await StockMovement.findAll({
      where: { item_id: item.id },
      order: [["createdAt", "DESC"]],
      limit: 10,
    });

    return res.status(200).json({
      success: true,
      message: "Stock item fetched successfully",
      data: {
        item,
        recent_movements: movements,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock item",
      error: error.message,
    });
  }
};

export const updateStockStatus = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { current_status, remarks } = req.body;
    const user = req.user;

    const where = { id };

    if (user?.role !== "super_admin") {
      where.branch_id = user?.branch_id;
    }

    const item = await Item.findOne({ where, transaction: t });

    if (!item) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    const previousStatus = item.current_status;

    await item.update(
      { current_status },
      { transaction: t }
    );

    const movement = await StockMovement.create(
      {
        item_id: item.id,
        branch_id: item.branch_id,
        movement_type: "adjustment",
        qty: item.unit === "piece" ? 1 : 0,
        weight: item.gross_weight || 0,
        previous_status: previousStatus,
        new_status: current_status,
        reference_type: "item_status_update",
        remarks: remarks || `Status changed from ${previousStatus} to ${current_status}`,
        created_by: user?.id || null,
      },
      { transaction: t }
    );

    await createActivityLog({
      branch_id: item.branch_id,
      user_id: user?.id || null,
      module: "stock",
      action: "update_status",
      entity_type: "item",
      entity_id: item.id,
      title: "Stock item status updated",
      description: `${item.item_name} status changed from ${previousStatus} to ${current_status}`,
      metadata: {
        item_id: item.id,
        article_code: item.article_code,
        previous_status: previousStatus,
        new_status: current_status,
        movement_id: movement.id,
      },
    });

    await t.commit();

    return res.status(200).json({
      success: true,
      message: "Stock status updated successfully",
      data: item,
    });
  } catch (error) {
    await t.rollback();

    return res.status(500).json({
      success: false,
      message: "Failed to update stock status",
      error: error.message,
    });
  }
};

export const stockSummary = async (req, res) => {
  try {
    const user = req.user;

    const where = {};

    if (user?.role !== "super_admin") {
      where.branch_id = user?.branch_id;
    }

    const totalStock = await Item.count({
      where: {
        ...where,
        current_status: "in_stock",
      },
    });

    const deadStock = await Item.count({
      where: {
        ...where,
        current_status: "damaged",
      },
    });

    const transitGoods = await Item.count({
      where: {
        ...where,
        current_status: "transit",
      },
    });

    const soldItems = await Item.count({
      where: {
        ...where,
        current_status: "sold",
      },
    });

    const reservedItems = await Item.count({
      where: {
        ...where,
        current_status: "reserved",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Stock summary fetched successfully",
      data: {
        total_stock: totalStock,
        dead_stock: deadStock,
        transit_goods: transitGoods,
        sold_items: soldItems,
        reserved_items: reservedItems,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock summary",
      error: error.message,
    });
  }
};

export const addStockIn = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { item_id, remarks } = req.body;
    const user = req.user;

    const item = await Item.findByPk(item_id, { transaction: t });

    if (!item) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    const previousStatus = item.current_status;

    await item.update(
      { current_status: "in_stock" },
      { transaction: t }
    );

    const movement = await StockMovement.create(
      {
        item_id: item.id,
        branch_id: item.branch_id,
        movement_type: "stock_in",
        qty: item.unit === "piece" ? 1 : 0,
        weight: item.gross_weight || 0,
        previous_status: previousStatus,
        new_status: "in_stock",
        reference_type: "manual_stock_in",
        remarks: remarks || "Stock inward completed",
        created_by: user?.id || null,
      },
      { transaction: t }
    );

    await createActivityLog({
      branch_id: item.branch_id,
      user_id: user?.id || null,
      module: "stock",
      action: "stock_in",
      entity_type: "item",
      entity_id: item.id,
      title: "Stock added",
      description: `${item.item_name} added into stock`,
      metadata: {
        item_id: item.id,
        article_code: item.article_code,
        movement_id: movement.id,
      },
    });

    await t.commit();

    return res.status(200).json({
      success: true,
      message: "Stock inward successful",
      data: item,
    });
  } catch (error) {
    await t.rollback();

    return res.status(500).json({
      success: false,
      message: "Failed to add stock inward",
      error: error.message,
    });
  }
};