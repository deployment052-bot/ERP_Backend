import sequelize from "../config/db.js";
import { Op, fn, col, literal, QueryTypes } from "sequelize";
import Store from "../model/Store.js";
import Stock from "../model/stockrecord.js";
import Item from "../model/item.js";
import StockTransfer from "../model/stockTransfer.js";
import StockTransferItem from "../model/stockTransferItem.js";
import ActivityLog from "../model/activityLog.js";
import User from "../model/user.js"
import Invoice from "../model/invoices.js"
import Transaction from "../model/Transaction.js";
import InvoiceItem from "../model/InvoiceItem.js";



export const getDistrictDashboard = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    if (
      user.role !== "district_manager" &&
      String(user.organization_level || "").toLowerCase() !== "district"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only district users can access this dashboard",
      });
    }

    const districtId = Number(user.organization_id);
    const districtCode = user.store_code || null;

    if (!districtId) {
      return res.status(400).json({
        success: false,
        message: "District organization_id not found for logged-in user",
      });
    }

    // -----------------------------
    // 1) District ke under stores
    // -----------------------------
    let districtStores = [];

    try {
      districtStores = await Store.findAll({
        where: {
          [Op.or]: [
            { district_id: districtId },
            ...(districtCode ? [{ district_code: districtCode }] : []),
          ],
        },
        attributes: ["id", "store_name", "store_code", "district_id", "district_code"],
        raw: true,
      });
    } catch (err) {
      districtStores = [];
    }

    const storeIds = districtStores.map((s) => Number(s.id)).filter(Boolean);

    // -----------------------------
    // 2) District ke direct items
    // -----------------------------
    let districtItemRows = [];
    try {
      districtItemRows = await Item.findAll({
        where: {
          organization_id: districtId,
        },
        attributes: [
          "id",
          "article_code",
          "sku_code",
          "item_name",
          "metal_type",
          "category",
          "details",
          "purity",
          "gross_weight",
          "net_weight",
          "stone_weight",
          "stone_amount",
          "making_charge",
          "purchase_rate",
          "sale_rate",
          "hsn_code",
          "unit",
          "current_status",
          "organization_id",
          "createdAt",
          "updatedAt",
        ],
        raw: true,
      });
    } catch (err) {
      districtItemRows = [];
    }

    const districtItemIds = districtItemRows.map((i) => Number(i.id)).filter(Boolean);

    // --------------------------------------
    // 3) District ke direct stock rows
    // --------------------------------------
    let districtStockRows = [];
    try {
      districtStockRows = await Stock.findAll({
        where: {
          [Op.or]: [
            { organization_id: districtId },
            ...(districtItemIds.length ? [{ item_id: { [Op.in]: districtItemIds } }] : []),
          ],
        },
        attributes: [
          "id",
          "organization_id",
          "item_id",
          "available_qty",
          "available_weight",
          "reserved_qty",
          "reserved_weight",
          "transit_qty",
          "transit_weight",
          "damaged_qty",
          "damaged_weight",
          "dead_qty",
          "dead_weight",
          "created_at",
          "updated_at",
        ],
        include: [
          {
            model: Item,
            attributes: [
              "id",
              "article_code",
              "sku_code",
              "item_name",
              "metal_type",
              "category",
              "details",
              "purity",
              "gross_weight",
              "net_weight",
              "stone_weight",
              "stone_amount",
              "making_charge",
              "purchase_rate",
              "sale_rate",
              "hsn_code",
              "unit",
              "current_status",
              "organization_id",
              "createdAt",
              "updatedAt",
            ],
            required: false,
          },
        ],
      });
    } catch (err) {
      districtStockRows = [];
    }

    // --------------------------------------
    // 4) Stores ke stock rows
    // --------------------------------------
    let storeStockRows = [];
    try {
      if (storeIds.length) {
        storeStockRows = await Stock.findAll({
          where: {
            organization_id: {
              [Op.in]: storeIds,
            },
          },
          attributes: [
            "id",
            "organization_id",
            "item_id",
            "available_qty",
            "available_weight",
            "reserved_qty",
            "reserved_weight",
            "transit_qty",
            "transit_weight",
            "damaged_qty",
            "damaged_weight",
            "dead_qty",
            "dead_weight",
            "created_at",
            "updated_at",
          ],
          include: [
            {
              model: Item,
              attributes: [
                "id",
                "article_code",
                "sku_code",
                "item_name",
                "metal_type",
                "category",
                "details",
                "purity",
                "gross_weight",
                "net_weight",
                "stone_weight",
                "stone_amount",
                "making_charge",
                "purchase_rate",
                "sale_rate",
                "hsn_code",
                "unit",
                "current_status",
                "organization_id",
                "createdAt",
                "updatedAt",
              ],
              required: false,
            },
          ],
        });
      }
    } catch (err) {
      storeStockRows = [];
    }

    // --------------------------------------
    // 5) Map district items with stock
    // --------------------------------------
    const districtStockMap = new Map();
    for (const row of districtStockRows) {
      const itemId = Number(row.item_id);
      if (!districtStockMap.has(itemId)) {
        districtStockMap.set(itemId, row);
      }
    }

    const districtItems = districtItemRows.map((item) => {
      const stock = districtStockMap.get(Number(item.id));

      return {
        item_id: item.id,
        article_code: item.article_code || null,
        sku_code: item.sku_code || null,
        item_name: item.item_name || null,
        metal_type: item.metal_type || null,
        category: item.category || null,
        details: item.details || null,
        purity: item.purity || null,
        gross_weight: Number(item.gross_weight || 0),
        net_weight: Number(item.net_weight || 0),
        stone_weight: Number(item.stone_weight || 0),
        stone_amount: Number(item.stone_amount || 0),
        making_charge: Number(item.making_charge || 0),
        purchase_rate: Number(item.purchase_rate || 0),
        sale_rate: Number(item.sale_rate || 0),
        hsn_code: item.hsn_code || null,
        unit: item.unit || null,
        current_status: item.current_status || null,
        available_qty: Number(stock?.available_qty || 0),
        available_weight: Number(stock?.available_weight || 0),
        reserved_qty: Number(stock?.reserved_qty || 0),
        reserved_weight: Number(stock?.reserved_weight || 0),
        transit_qty: Number(stock?.transit_qty || 0),
        transit_weight: Number(stock?.transit_weight || 0),
        damaged_qty: Number(stock?.damaged_qty || 0),
        damaged_weight: Number(stock?.damaged_weight || 0),
        dead_qty: Number(stock?.dead_qty || 0),
        dead_weight: Number(stock?.dead_weight || 0),
        stock_id: stock?.id || null,
        has_stock: !!stock,
        item_created_at: item.createdAt,
        item_updated_at: item.updatedAt,
      };
    });

    // --------------------------------------
    // 6) Summary calculations
    // --------------------------------------
    let districtOwnStock = 0;
    let retailStoresStocks = 0;
    let totalStock = 0;

    let totalAvailableQty = 0;
    let totalReservedQty = 0;
    let totalTransitQty = 0;
    let totalDamagedQty = 0;
    let totalDeadQty = 0;

    let totalAvailableWeight = 0;
    let totalReservedWeight = 0;
    let totalTransitWeight = 0;
    let totalDamagedWeight = 0;
    let totalDeadWeight = 0;

    let deadStockItems = 0;
    let damagedStockItems = 0;
    let transitGoods = 0;
    let goldPriceValue = 0;
    let silverPriceValue = 0;

    for (const item of districtItems) {
      const totalQty =
        Number(item.available_qty || 0) +
        Number(item.reserved_qty || 0) +
        Number(item.transit_qty || 0);

      const totalWeight =
        Number(item.available_weight || 0) +
        Number(item.reserved_weight || 0) +
        Number(item.transit_weight || 0);

      districtOwnStock += totalQty;
      totalStock += totalQty;

      totalAvailableQty += Number(item.available_qty || 0);
      totalReservedQty += Number(item.reserved_qty || 0);
      totalTransitQty += Number(item.transit_qty || 0);
      totalDamagedQty += Number(item.damaged_qty || 0);
      totalDeadQty += Number(item.dead_qty || 0);

      totalAvailableWeight += Number(item.available_weight || 0);
      totalReservedWeight += Number(item.reserved_weight || 0);
      totalTransitWeight += Number(item.transit_weight || 0);
      totalDamagedWeight += Number(item.damaged_weight || 0);
      totalDeadWeight += Number(item.dead_weight || 0);

      transitGoods += Number(item.transit_qty || 0);

      if (Number(item.dead_qty || 0) > 0 || Number(item.dead_weight || 0) > 0) {
        deadStockItems += 1;
      }

      if (
        Number(item.damaged_qty || 0) > 0 ||
        Number(item.damaged_weight || 0) > 0
      ) {
        damagedStockItems += 1;
      }

      const metalType = String(item.metal_type || "").toLowerCase();
      const rate = Number(item.sale_rate || item.purchase_rate || 0);
      const valueBase = totalWeight > 0 ? totalWeight : totalQty;

      if (metalType === "gold") goldPriceValue += valueBase * rate;
      if (metalType === "silver") silverPriceValue += valueBase * rate;
    }

    for (const row of storeStockRows) {
      const availableQty = Number(row.available_qty || 0);
      const reservedQty = Number(row.reserved_qty || 0);
      const transitQty = Number(row.transit_qty || 0);
      const damagedQty = Number(row.damaged_qty || 0);
      const deadQty = Number(row.dead_qty || 0);

      const availableWeight = Number(row.available_weight || 0);
      const reservedWeight = Number(row.reserved_weight || 0);
      const transitWeight = Number(row.transit_weight || 0);
      const damagedWeight = Number(row.damaged_weight || 0);
      const deadWeight = Number(row.dead_weight || 0);

      const totalQty = availableQty + reservedQty + transitQty;
      const totalWeight = availableWeight + reservedWeight + transitWeight;

      retailStoresStocks += totalQty;
      totalStock += totalQty;

      totalAvailableQty += availableQty;
      totalReservedQty += reservedQty;
      totalTransitQty += transitQty;
      totalDamagedQty += damagedQty;
      totalDeadQty += deadQty;

      totalAvailableWeight += availableWeight;
      totalReservedWeight += reservedWeight;
      totalTransitWeight += transitWeight;
      totalDamagedWeight += damagedWeight;
      totalDeadWeight += deadWeight;

      transitGoods += transitQty;

      if (deadQty > 0 || deadWeight > 0) {
        deadStockItems += 1;
      }

      if (damagedQty > 0 || damagedWeight > 0) {
        damagedStockItems += 1;
      }

      const metalType = String(row.Item?.metal_type || "").toLowerCase();
      const rate = Number(row.Item?.sale_rate || row.Item?.purchase_rate || 0);
      const valueBase = totalWeight > 0 ? totalWeight : totalQty;

      if (metalType === "gold") goldPriceValue += valueBase * rate;
      if (metalType === "silver") silverPriceValue += valueBase * rate;
    }

    // --------------------------------------
    // 7) Store performance
    // --------------------------------------
    const storePerformance = districtStores.map((store) => {
      const rows = storeStockRows.filter(
        (x) => Number(x.organization_id) === Number(store.id)
      );

      let revenue = 0;
      let stock_count = 0;

      for (const row of rows) {
        stock_count += 1;

        const qty =
          Number(row.available_qty || 0) +
          Number(row.reserved_qty || 0) +
          Number(row.transit_qty || 0);

        const weight =
          Number(row.available_weight || 0) +
          Number(row.reserved_weight || 0) +
          Number(row.transit_weight || 0);

        const rate = Number(row.Item?.sale_rate || row.Item?.purchase_rate || 0);
        const base = weight > 0 ? weight : qty;

        revenue += base * rate;
      }

      return {
        store_id: store.id,
        store_name: store.store_name,
        store_code: store.store_code,
        revenue,
        stock_count,
      };
    });

    // --------------------------------------
    // 8) Transit details
    // --------------------------------------
    let inTransitDetails = [];
    try {
      const transitRows = await StockTransferItem.findAll({
        include: [
          {
            model: StockTransfer,
            required: true,
            where: {
              status: {
                [Op.in]: ["dispatched", "in_transit"],
              },
              [Op.or]: [
                { to_district_id: districtId },
                { from_district_id: districtId },
                ...(districtCode
                  ? [
                      { to_district_code: districtCode },
                      { from_district_code: districtCode },
                    ]
                  : []),
              ],
            },
            attributes: ["id", "status", "tracking_number"],
          },
        ],
        attributes: ["id", "item_id", "qty", "weight"],
      });

      inTransitDetails = transitRows.map((row) => ({
        id: row.id,
        item_id: row.item_id,
        qty: Number(row.qty || 0),
        weight: Number(row.weight || 0),
        transfer: row.StockTransfer || null,
      }));
    } catch (err) {
      inTransitDetails = [];
    }

    // --------------------------------------
    // 9) Recent activities
    // --------------------------------------
    let recentActivities = [];
    try {
      recentActivities = await ActivityLog.findAll({
        where: {
          [Op.or]: [
            { district_id: districtId },
            { organization_id: districtId },
            ...(districtCode ? [{ district_code: districtCode }] : []),
          ],
        },
        attributes: ["id", "module", "action", "description", "created_at"],
        order: [["created_at", "DESC"]],
        limit: 5,
        raw: true,
      });
    } catch (err) {
      recentActivities = [];
    }

    // --------------------------------------
    // 10) Profit & loss placeholder
    // --------------------------------------
    const profitLoss = [
      { month: "Jan", amount: 520 },
      { month: "Feb", amount: 550 },
      { month: "Mar", amount: 580 },
      { month: "Apr", amount: 560 },
      { month: "May", amount: 620 },
      { month: "Jun", amount: 650 },
    ];

    return res.status(200).json({
      success: true,
      message: "District dashboard fetched successfully",
      data: {
        district_id: districtId,
        district_code: districtCode,

        summary: {
          total_stock: totalStock,
          retail_stores_stocks: retailStoresStocks,
          district_own_stock: districtOwnStock,
          dead_stock_items: deadStockItems,
          damaged_stock_items: damagedStockItems,
          transit_goods: transitGoods,
          gold_price_value: goldPriceValue,
          silver_price_value: silverPriceValue,
          total_inventory_value: goldPriceValue + silverPriceValue,
          total_available_qty: totalAvailableQty,
          total_reserved_qty: totalReservedQty,
          total_transit_qty: totalTransitQty,
          total_damaged_qty: totalDamagedQty,
          total_dead_qty: totalDeadQty,
          total_available_weight: totalAvailableWeight,
          total_reserved_weight: totalReservedWeight,
          total_transit_weight: totalTransitWeight,
          total_damaged_weight: totalDamagedWeight,
          total_dead_weight: totalDeadWeight,
          total_stores: districtStores.length,
          district_item_count: districtItems.length,
          district_items_with_stock: districtItems.filter((x) => x.has_stock).length,
          district_items_without_stock: districtItems.filter((x) => !x.has_stock).length,
          gold_item_count: districtItems.filter(
            (x) => String(x.metal_type || "").toLowerCase() === "gold"
          ).length,
          silver_item_count: districtItems.filter(
            (x) => String(x.metal_type || "").toLowerCase() === "silver"
          ).length,
          category_count: [...new Set(districtItems.map((x) => x.category).filter(Boolean))]
            .length,
          store_stock_row_count: storeStockRows.length,
        },

        store_performance: storePerformance,
        profit_loss: profitLoss,
        recent_activities: recentActivities,

        district_inventory: {
          item_count: districtItems.length,
          items: districtItems,
        },

        in_transit_details: inTransitDetails,
      },
    });
  } catch (error) {
    console.error("getDistrictDashboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch district dashboard",
      error: error.message,
    });
  }
};


export const addDistrictItemWithStock = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const user = req.user;

    if (!user) {
      await transaction.rollback();
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    if (
      user.role !== "district_manager" &&
      String(user.organization_level || "").toLowerCase() !== "district"
    ) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only district manager can add district stock",
      });
    }

    const {
      article_code,
      sku_code,
      item_name,
      metal_type,
      category,
      details,
      purity,
      gross_weight,
      net_weight,
      stone_weight,
      stone_amount,
      making_charge,
      purchase_rate,
      sale_rate,
      hsn_code,
      unit,
      current_status,

      available_qty,
      available_weight,
      reserved_qty,
      reserved_weight,
      transit_qty,
      transit_weight,
      damaged_qty,
      damaged_weight,
      dead_qty,
      dead_weight,
    } = req.body;

    if (!article_code || !item_name || !metal_type || !category || !purity) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "article_code, item_name, metal_type, category, purity are required",
      });
    }

    const existingItem = await Item.findOne({
      where: { article_code },
      transaction,
    });

    if (existingItem) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Item with this article_code already exists",
      });
    }

    if (sku_code) {
      const existingSku = await Item.findOne({
        where: { sku_code },
        transaction,
      });

      if (existingSku) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Item with this sku_code already exists",
        });
      }
    }

    const item = await Item.create(
      {
        article_code,
        sku_code: sku_code || null,
        item_name,
        metal_type,
        category,
        details: details || null,
        purity,
        gross_weight: gross_weight || 0,
        net_weight: net_weight || 0,
        stone_weight: stone_weight || 0,
        stone_amount: stone_amount || 0,
        making_charge: making_charge || 0,
        purchase_rate: purchase_rate || 0,
        sale_rate: sale_rate || 0,
        hsn_code: hsn_code || null,
        unit: unit || "gram",
        current_status: current_status || "in_stock",
        organization_id: user.organization_id,
        organization_level: "district",
      },
      { transaction }
    );

    const stock = await Stock.create(
      {
        organization_id: user.organization_id,
        organization_level: "district",
        item_id: item.id,
        available_qty: available_qty || 0,
        available_weight: available_weight || 0,
        reserved_qty: reserved_qty || 0,
        reserved_weight: reserved_weight || 0,
        transit_qty: transit_qty || 0,
        transit_weight: transit_weight || 0,
        damaged_qty: damaged_qty || 0,
        damaged_weight: damaged_weight || 0,
        dead_qty: dead_qty || 0,
        dead_weight: dead_weight || 0,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "District item and stock added successfully",
      data: {
        item,
        stock,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("addDistrictItemWithStock error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add district item and stock",
      error: error.message,
    });
  }
}



const safeNumber = (value) => {
  const num = Number(value || 0);
  return Number.isNaN(num) ? 0 : num;
};

const normalizeLevel = (level = "") => String(level).toLowerCase();

const getDistrictFromUser = async (user) => {
  const orgLevel = normalizeLevel(user.organization_level);

  if (orgLevel !== "district") {
    throw new Error("Only district user can access this module");
  }

  // case 1: user.organization_id directly district id ho
  let district = await District.findByPk(user.organization_id);

  // case 2: agar organization_id kisi aur structure ko refer karta ho,
  // aur district_code token me ho to district_code se bhi check kar lo
  if (!district && user.district_code) {
    district = await District.findOne({
      where: { district_code: user.district_code },
    });
  }

  if (!district) {
    throw new Error("District not found for logged in user");
  }

  return district;
};

/**
 * GET /api/district/store-management
 * District user ke under saare stores + summary
 */
export const getDistrictStoreManagement = async (req, res) => {
  try {
    const { search = "", status = "all" } = req.query;
    const user = req.user;

    const district = await getDistrictFromUser(user);

    const storeWhere = {
      district_id: district.id,
    };

    if (search?.trim()) {
      storeWhere[Op.or] = [
        { store_name: { [Op.iLike]: `%${search.trim()}%` } },
        { store_code: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    if (status === "active") {
      storeWhere.is_active = true;
    } else if (status === "inactive") {
      storeWhere.is_active = false;
    }

    const stores = await Store.findAll({
      where: storeWhere,
      attributes: [
        "id",
        "store_name",
        "store_code",
        "district_id",
        "is_active",
      ],
      order: [["store_name", "ASC"]],
      raw: true,
    });

    const storeIds = stores.map((s) => s.id);

    let employeesByStore = {};
    if (storeIds.length) {
      const employeeRows = await User.findAll({
        attributes: [
          "organization_id",
          [fn("COUNT", col("id")), "employee_count"],
        ],
        where: {
          organization_id: { [Op.in]: storeIds },
        },
        group: ["organization_id"],
        raw: true,
      });

      employeesByStore = employeeRows.reduce((acc, row) => {
        acc[row.organization_id] = safeNumber(row.employee_count);
        return acc;
      }, {});
    }

    // Revenue logic:
    // agar tumhare paas Ledger/Invoice model hai to yahan actual revenue lagao.
    // फिलहाल fallback 0 rakha hai, ya tum below commented version use kar sakte ho.
    let revenueByStore = {};

    /*
    if (storeIds.length) {
      const revenueRows = await Ledger.findAll({
        attributes: [
          "organization_id",
          [fn("SUM", col("amount")), "revenue"],
        ],
        where: {
          organization_id: { [Op.in]: storeIds },
          type: "SALE",
        },
        group: ["organization_id"],
        raw: true,
      });

      revenueByStore = revenueRows.reduce((acc, row) => {
        acc[row.organization_id] = safeNumber(row.revenue);
        return acc;
      }, {});
    }
    */

    const finalStores = stores.map((store) => ({
      id: store.id,
      store_name: store.store_name,
      store_code: store.store_code,
      is_active: !!store.is_active,
      employees: employeesByStore[store.id] || 0,
      revenue: revenueByStore[store.id] || 0,
    }));

    const summary = {
      total_stores: finalStores.length,
      active_stores: finalStores.filter((s) => s.is_active).length,
      total_employees: finalStores.reduce(
        (sum, store) => sum + safeNumber(store.employees),
        0
      ),
      total_revenue: finalStores.reduce(
        (sum, store) => sum + safeNumber(store.revenue),
        0
      ),
    };

    return res.status(200).json({
      success: true,
      message: "District store management fetched successfully",
      data: {
        district: {
          id: district.id,
          district_name: district.district_name,
          district_code: district.district_code,
        },
        summary,
        stores: finalStores,
      },
    });
  } catch (error) {
    console.error("getDistrictStoreManagement error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch district store management",
      error: error.message,
    });
  }
};

/**
 * GET /api/district/store-management/:storeId
 * Single store inventory details
 */
export const getDistrictStoreInventory = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { search = "", category = "" } = req.query;
    const user = req.user;

    const district = await getDistrictFromUser(user);

    const store = await Store.findOne({
      where: {
        id: storeId,
        district_id: district.id,
      },
      attributes: ["id", "store_name", "store_code", "district_id", "is_active"],
      raw: true,
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found under your district",
      });
    }

    const itemWhere = {};
    if (search?.trim()) {
      itemWhere[Op.or] = [
        { item_name: { [Op.iLike]: `%${search.trim()}%` } },
        { article_code: { [Op.iLike]: `%${search.trim()}%` } },
        { sku_code: { [Op.iLike]: `%${search.trim()}%` } },
        { category: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    if (category?.trim()) {
      itemWhere.category = category.trim();
    }

    const inventory = await Stock.findAll({
      where: {
        organization_id: store.id,
      },
      include: [
        {
          model: Item,
          attributes: [
            "id",
            "item_name",
            "article_code",
            "sku_code",
            "category",
            "purity",
            "gross_weight",
            "net_weight",
            "stone_weight",
            "making_charge",
            "sale_rate",
          ],
          where: itemWhere,
          required: true,
        },
      ],
      attributes: [
        "id",
        "organization_id",
        "item_id",
        "available_qty",
        "available_weight",
        "reserved_qty",
        "reserved_weight",
        "transit_qty",
        "transit_weight",
        "damaged_qty",
        "damaged_weight",
      ],
      order: [[Item, "category", "ASC"], [Item, "item_name", "ASC"]],
    });

    const rows = inventory.map((row) => ({
      stock_id: row.id,
      item_id: row.Item?.id || null,
      item_name: row.Item?.item_name || null,
      category: row.Item?.category || null,
      code: row.Item?.article_code || row.Item?.sku_code || null,
      quantity: safeNumber(row.available_qty),
      selling_price: safeNumber(row.Item?.sale_rate),
      making_charge: safeNumber(row.Item?.making_charge),
      purity: row.Item?.purity || null,
      net_weight: safeNumber(row.Item?.net_weight),
      stone_weight: safeNumber(row.Item?.stone_weight),
      gross_weight: safeNumber(row.Item?.gross_weight),
      available_weight: safeNumber(row.available_weight),
      reserved_qty: safeNumber(row.reserved_qty),
      reserved_weight: safeNumber(row.reserved_weight),
      transit_qty: safeNumber(row.transit_qty),
      transit_weight: safeNumber(row.transit_weight),
      damaged_qty: safeNumber(row.damaged_qty),
      damaged_weight: safeNumber(row.damaged_weight),
    }));

    return res.status(200).json({
      success: true,
      message: "Store inventory fetched successfully",
      data: {
        store: {
          id: store.id,
          store_name: store.store_name,
          store_code: store.store_code,
          is_active: !!store.is_active,
        },
        count: rows.length,
        inventory: rows,
      },
    });
  } catch (error) {
    console.error("getDistrictStoreInventory error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch store inventory",
      error: error.message,
    });
  }
};







const hasAttr = (model, field) =>
  !!model?.rawAttributes && !!model.rawAttributes[field];

const num = (v) => Number(v || 0);

const getStoreNameField = () => {
  if (hasAttr(Store, "store_name")) return "store_name";
  if (hasAttr(Store, "name")) return "name";
  return "store_name";
};

const getStoreCodeField = () => {
  if (hasAttr(Store, "store_code")) return "store_code";
  if (hasAttr(Store, "code")) return "code";
  return "store_code";
};

const getCreatedField = () => {
  if (hasAttr(Item, "createdAt")) return "createdAt";
  if (hasAttr(Item, "created_at")) return "created_at";
  return "id";
};

/**
 * 1) District -> all connected retail stores
 * GET /api/district/store-management/stores
 */
export const getDistrictRetailStores = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { organization_id, organization_level, role } = req.user;
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim().toLowerCase();

    if (!organization_id) {
      return res.status(400).json({
        success: false,
        message: "organization_id missing in req.user",
      });
    }

    const level = String(organization_level || "").toLowerCase();
    const userRole = String(role || "").toLowerCase().replace(/_/g, "-");

    if (
      level !== "district" &&
      !["district-manager", "district-tl", "district-admin"].includes(userRole)
    ) {
      return res.status(403).json({
        success: false,
        message: "Only district users can access this API",
      });
    }

    const storeNameField = getStoreNameField();
    const storeCodeField = getStoreCodeField();

    const where = {
      district_id: organization_id,
      id: {
        [Op.ne]: organization_id,
      },
    };

    const andConditions = [];

    // only retail stores
    if (hasAttr(Store, "organization_level")) {
      andConditions.push(
        sequelize.where(
          sequelize.fn("LOWER", sequelize.col("organization_level")),
          "retail"
        )
      );
    }

    // exclude district/state/head office style records by code if present
    if (hasAttr(Store, "store_code")) {
      andConditions.push({
        store_code: {
          [Op.notILike]: "DST%",
        },
      });
      andConditions.push({
        store_code: {
          [Op.notILike]: "STATE%",
        },
      });
      andConditions.push({
        store_code: {
          [Op.notILike]: "HO%",
        },
      });
      andConditions.push({
        store_code: {
          [Op.notILike]: "DIST%",
        },
      });
    }

    if (status === "active" && hasAttr(Store, "is_active")) {
      where.is_active = true;
    }

    if (status === "inactive" && hasAttr(Store, "is_active")) {
      where.is_active = false;
    }

    if (search) {
      const searchConditions = [];

      if (storeNameField) {
        searchConditions.push({
          [storeNameField]: {
            [Op.iLike]: `%${search}%`,
          },
        });
      }

      if (storeCodeField) {
        searchConditions.push({
          [storeCodeField]: {
            [Op.iLike]: `%${search}%`,
          },
        });
      }

      if (hasAttr(Store, "district")) {
        searchConditions.push({
          district: {
            [Op.iLike]: `%${search}%`,
          },
        });
      }

      if (hasAttr(Store, "state")) {
        searchConditions.push({
          state: {
            [Op.iLike]: `%${search}%`,
          },
        });
      }

      if (searchConditions.length) {
        andConditions.push({
          [Op.or]: searchConditions,
        });
      }
    }

    if (andConditions.length) {
      where[Op.and] = andConditions;
    }

    const stores = await Store.findAll({
      where,
      order: [[storeNameField, "ASC"]],
      raw: false,
    });

    const storeIds = stores.map((s) => s.id);

    if (!storeIds.length) {
      return res.status(200).json({
        success: true,
        message: "District retail stores fetched successfully",
        data: {
          summary: {
            total_stores: 0,
            active_stores: 0,
            total_employees: 0,
            total_stock_value: 0,
            total_revenue: 0,
          },
          stores: [],
        },
      });
    }

    const stockRows = await Stock.findAll({
      attributes: [
        [sequelize.col("Stock.organization_id"), "organization_id"],
        [
          sequelize.fn("SUM", sequelize.col("Stock.available_qty")),
          "available_qty",
        ],
        [
          sequelize.fn("SUM", sequelize.col("Stock.available_weight")),
          "available_weight",
        ],
        [
          sequelize.fn("SUM", sequelize.col("Stock.reserved_qty")),
          "reserved_qty",
        ],
        [
          sequelize.fn("SUM", sequelize.col("Stock.reserved_weight")),
          "reserved_weight",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              `COALESCE("Stock"."available_qty", 0) * COALESCE("item"."sale_rate", 0)`
            )
          ),
          "stock_value",
        ],
      ],
      where: {
        organization_id: {
          [Op.in]: storeIds,
        },
      },
      include: [
        {
          model: Item,
          as: "item",
          attributes: [],
          required: false,
        },
      ],
      group: [sequelize.col("Stock.organization_id")],
      raw: true,
    });

    const employeeRows = await User.findAll({
      attributes: [
        ["organization_id", "organization_id"],
        [sequelize.fn("COUNT", sequelize.col("id")), "employee_count"],
      ],
      where: {
        organization_id: {
          [Op.in]: storeIds,
        },
        ...(hasAttr(User, "is_active") ? { is_active: true } : {}),
      },
      group: ["organization_id"],
      raw: true,
    });

    let revenueRows = [];
    try {
      revenueRows = await Invoice.findAll({
        attributes: [
          ["organization_id", "organization_id"],
          [
            sequelize.fn(
              "SUM",
              sequelize.fn("COALESCE", sequelize.col("total_amount"), 0)
            ),
            "revenue",
          ],
        ],
        where: {
          organization_id: {
            [Op.in]: storeIds,
          },
        },
        group: ["organization_id"],
        raw: true,
      });
    } catch (invoiceError) {
      console.error(
        "Invoice revenue aggregation skipped:",
        invoiceError.message
      );
      revenueRows = [];
    }

    const stockMap = {};
    for (const row of stockRows) {
      stockMap[row.organization_id] = {
        available_qty: num(row.available_qty),
        available_weight: num(row.available_weight),
        reserved_qty: num(row.reserved_qty),
        reserved_weight: num(row.reserved_weight),
        stock_value: num(row.stock_value),
      };
    }

    const employeeMap = {};
    for (const row of employeeRows) {
      employeeMap[row.organization_id] = num(row.employee_count);
    }

    const revenueMap = {};
    for (const row of revenueRows) {
      revenueMap[row.organization_id] = num(row.revenue);
    }

    const finalStores = stores.map((store) => {
      const stock = stockMap[store.id] || {
        available_qty: 0,
        available_weight: 0,
        reserved_qty: 0,
        reserved_weight: 0,
        stock_value: 0,
      };

      return {
        id: store.id,
        store_code: store[storeCodeField] || null,
        store_name: store[storeNameField] || null,
        district_id: store.district_id || null,
        district: hasAttr(Store, "district") ? store.district : null,
        state: hasAttr(Store, "state") ? store.state : null,
        address: hasAttr(Store, "address") ? store.address : null,
        phone_number: hasAttr(Store, "phone_number")
          ? store.phone_number
          : null,
        is_active: hasAttr(Store, "is_active") ? !!store.is_active : true,
        employee_count: employeeMap[store.id] || 0,
        available_qty: stock.available_qty,
        available_weight: stock.available_weight,
        reserved_qty: stock.reserved_qty,
        reserved_weight: stock.reserved_weight,
        stock_value: stock.stock_value,
        revenue: revenueMap[store.id] || 0,
      };
    });

    const summary = {
      total_stores: finalStores.length,
      active_stores: finalStores.filter((s) => s.is_active).length,
      total_employees: finalStores.reduce(
        (sum, store) => sum + num(store.employee_count),
        0
      ),
      total_stock_value: finalStores.reduce(
        (sum, store) => sum + num(store.stock_value),
        0
      ),
      total_revenue: finalStores.reduce(
        (sum, store) => sum + num(store.revenue),
        0
      ),
    };

    return res.status(200).json({
      success: true,
      message: "District retail stores fetched successfully",
      data: {
        summary,
        stores: finalStores,
      },
    });
  } catch (error) {
    console.error("getDistrictRetailStores error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch district retail stores",
      error: error.message,
    });
  }
};
/**
 * 2) Click store -> store stock summary + categories
 * GET /api/district/store-management/stores/:storeId
 */
export const getDistrictStoreDetail = async (req, res) => {
  try {
    const { storeId } = req.params;
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "").trim();

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const districtId = req.user.organization_id;

    const store = await Store.findOne({
      where: {
        id: storeId,
        district_id: districtId,
      },
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found under your district",
      });
    }

    const storeNameField = getStoreNameField();
    const storeCodeField = getStoreCodeField();

    const stockSummary = await Stock.findOne({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("available_qty")), "available_qty"],
        [sequelize.fn("SUM", sequelize.col("available_weight")), "available_weight"],
        [sequelize.fn("SUM", sequelize.col("reserved_qty")), "reserved_qty"],
        [sequelize.fn("SUM", sequelize.col("reserved_weight")), "reserved_weight"],
        [sequelize.fn("SUM", sequelize.col("transit_qty")), "transit_qty"],
        [sequelize.fn("SUM", sequelize.col("transit_weight")), "transit_weight"],
        [sequelize.fn("SUM", sequelize.col("damaged_qty")), "damaged_qty"],
        [sequelize.fn("SUM", sequelize.col("damaged_weight")), "damaged_weight"],
      ],
      where: {
        organization_id: store.id,
      },
      raw: true,
    });

    const itemWhere = {
      organization_id: store.id,
    };

    if (category && category.toLowerCase() !== "all") {
      itemWhere.category = category;
    }

    if (search) {
      const searchConditions = [];

      if (hasAttr(Item, "item_name")) {
        searchConditions.push({
          item_name: { [Op.iLike]: `%${search}%` },
        });
      }

      if (hasAttr(Item, "article_code")) {
        searchConditions.push({
          article_code: { [Op.iLike]: `%${search}%` },
        });
      }

      if (hasAttr(Item, "sku_code")) {
        searchConditions.push({
          sku_code: { [Op.iLike]: `%${search}%` },
        });
      }

      if (hasAttr(Item, "category")) {
        searchConditions.push({
          category: { [Op.iLike]: `%${search}%` },
        });
      }

      if (searchConditions.length) {
        itemWhere[Op.or] = searchConditions;
      }
    }

    const items = await Item.findAll({
      where: itemWhere,
      include: [
        {
          model: Stock,
          as: "stocks",
          required: false,
          where: {
            organization_id: store.id,
          },
          attributes: [
            "available_qty",
            "available_weight",
            "reserved_qty",
            "reserved_weight",
            "transit_qty",
            "transit_weight",
            "damaged_qty",
            "damaged_weight",
          ],
        },
      ],
      order: [
        hasAttr(Item, "category") ? ["category", "ASC"] : ["id", "DESC"],
        hasAttr(Item, "item_name") ? ["item_name", "ASC"] : ["id", "DESC"],
      ],
    });

    const inventory = items.map((item) => {
      const stock = item.stocks?.[0] || {};

      const code =
        (hasAttr(Item, "article_code") && item.article_code) ||
        (hasAttr(Item, "sku_code") && item.sku_code) ||
        null;

      return {
        item_id: item.id,
        category: hasAttr(Item, "category") ? item.category : null,
        code,
        item_name: hasAttr(Item, "item_name") ? item.item_name : null,
        quantity: num(stock.available_qty),
        selling_price: num(item.sale_rate),
        making_charge: num(item.making_charge),
        purity: hasAttr(Item, "purity") ? item.purity : null,
        net_weight: num(item.net_weight),
        stone_weight: num(item.stone_weight),
        gross_weight: num(item.gross_weight),
        metal_type: hasAttr(Item, "metal_type") ? item.metal_type : null,
        current_status: hasAttr(Item, "current_status")
          ? item.current_status
          : null,
        image_url: hasAttr(Item, "image_url") ? item.image_url : null,
        stock: {
          available_qty: num(stock.available_qty),
          available_weight: num(stock.available_weight),
          reserved_qty: num(stock.reserved_qty),
          reserved_weight: num(stock.reserved_weight),
          transit_qty: num(stock.transit_qty),
          transit_weight: num(stock.transit_weight),
          damaged_qty: num(stock.damaged_qty),
          damaged_weight: num(stock.damaged_weight),
        },
        action: "view",
      };
    });

    const categoryOptions = [
      ...new Set(
        items
          .map((item) => (hasAttr(Item, "category") ? item.category : null))
          .filter(Boolean)
      ),
    ];

    return res.status(200).json({
      success: true,
      message: "Store detail fetched successfully",
      data: {
        store: {
          id: store.id,
          store_code: store[storeCodeField] || null,
          store_name: store[storeNameField] || null,
          district_id: store.district_id || null,
          district: hasAttr(Store, "district") ? store.district : null,
          state: hasAttr(Store, "state") ? store.state : null,
          address: hasAttr(Store, "address") ? store.address : null,
          phone_number: hasAttr(Store, "phone_number") ? store.phone_number : null,
          is_active: hasAttr(Store, "is_active") ? !!store.is_active : true,
        },
        stock_summary: {
          available_qty: num(stockSummary?.available_qty),
          available_weight: num(stockSummary?.available_weight),
          reserved_qty: num(stockSummary?.reserved_qty),
          reserved_weight: num(stockSummary?.reserved_weight),
          transit_qty: num(stockSummary?.transit_qty),
          transit_weight: num(stockSummary?.transit_weight),
          damaged_qty: num(stockSummary?.damaged_qty),
          damaged_weight: num(stockSummary?.damaged_weight),
        },
        filters: {
          selected_category: category || "All",
          search: search || "",
          categories: categoryOptions,
        },
        inventory,
      },
    });
  } catch (error) {
    console.error("getDistrictStoreDetail error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch store detail",
      error: error.message,
    });
  }
};
/**
 * 3) Click category -> all items
 * GET /api/district/store-management/stores/:storeId/categories/:category/items
 */
export const getDistrictStoreCategoryItems = async (req, res) => {
  try {
    const { storeId, category } = req.params;
    const search = String(req.query.search || "").trim();

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const districtId = req.user.organization_id;

    const store = await Store.findOne({
      where: {
        id: storeId,
        district_id: districtId,
      },
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found under your district",
      });
    }

    const itemWhere = {
      organization_id: store.id,
      category,
    };

    if (search) {
      itemWhere[Op.or] = [];

      if (hasAttr(Item, "item_name")) {
        itemWhere[Op.or].push({
          item_name: { [Op.iLike]: `%${search}%` },
        });
      }

      if (hasAttr(Item, "article_code")) {
        itemWhere[Op.or].push({
          article_code: { [Op.iLike]: `%${search}%` },
        });
      }

      if (hasAttr(Item, "sku_code")) {
        itemWhere[Op.or].push({
          sku_code: { [Op.iLike]: `%${search}%` },
        });
      }
    }

    const items = await Item.findAll({
      where: itemWhere,
      include: [
        {
          model: Stock,
          as: "stocks",
          required: false,
          where: {
            organization_id: store.id,
          },
          attributes: [
            "id",
            "available_qty",
            "available_weight",
            "reserved_qty",
            "reserved_weight",
            "transit_qty",
            "transit_weight",
            "damaged_qty",
            "damaged_weight",
          ],
        },
      ],
      order: [[getCreatedField(), "DESC"]],
    });

    const finalItems = items.map((item) => {
      const stock = item.stocks?.[0] || {};

      return {
        item_id: item.id,
        article_code: hasAttr(Item, "article_code") ? item.article_code : null,
        sku_code: hasAttr(Item, "sku_code") ? item.sku_code : null,
        item_name: hasAttr(Item, "item_name") ? item.item_name : null,
        category: hasAttr(Item, "category") ? item.category : null,
        metal_type: hasAttr(Item, "metal_type") ? item.metal_type : null,
        purity: hasAttr(Item, "purity") ? item.purity : null,
        gross_weight: num(item.gross_weight),
        net_weight: num(item.net_weight),
        stone_weight: num(item.stone_weight),
        making_charge: num(item.making_charge),
        sale_rate: num(item.sale_rate),
        purchase_rate: num(item.purchase_rate),
        hsn_code: hasAttr(Item, "hsn_code") ? item.hsn_code : null,
        unit: hasAttr(Item, "unit") ? item.unit : null,
        current_status: hasAttr(Item, "current_status")
          ? item.current_status
          : null,
        image_url: hasAttr(Item, "image_url") ? item.image_url : null,
        stock: {
          available_qty: num(stock.available_qty),
          available_weight: num(stock.available_weight),
          reserved_qty: num(stock.reserved_qty),
          reserved_weight: num(stock.reserved_weight),
          transit_qty: num(stock.transit_qty),
          transit_weight: num(stock.transit_weight),
          damaged_qty: num(stock.damaged_qty),
          damaged_weight: num(stock.damaged_weight),
        },
      };
    });

    return res.status(200).json({
      success: true,
      message: "Store category items fetched successfully",
      data: {
        store_id: store.id,
        category,
        total_items: finalItems.length,
        items: finalItems,
      },
    });
  } catch (error) {
    console.error("getDistrictStoreCategoryItems error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch store category items",
      error: error.message,
    });
  }
};







const safeNum = (val) => {
  const num = parseFloat(val);
  return Number.isNaN(num) ? 0 : num;
};

const getDateRange = (filter = "daily") => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (filter === "daily") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (filter === "weekly") {
    const day = now.getDay(); // 0 Sunday
    const diffToMonday = day === 0 ? 6 : day - 1;
    start.setDate(now.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);

    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (filter === "monthly") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  } else if (filter === "yearly") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);

    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
};

const buildBuckets = (filter, startDate) => {
  const buckets = [];

  if (filter === "daily") {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 0; i < 7; i++) {
      buckets.push({
        label: labels[i],
        cash_received: 0,
        account_transfer: 0,
        total_sales: 0,
      });
    }
  } else if (filter === "weekly") {
    for (let i = 1; i <= 7; i++) {
      buckets.push({
        label: `Day ${i}`,
        cash_received: 0,
        account_transfer: 0,
        total_sales: 0,
      });
    }
  } else if (filter === "monthly") {
    for (let i = 1; i <= 31; i++) {
      buckets.push({
        label: `${i}`,
        cash_received: 0,
        account_transfer: 0,
        total_sales: 0,
      });
    }
  } else if (filter === "yearly") {
    const labels = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    for (let i = 0; i < 12; i++) {
      buckets.push({
        label: labels[i],
        cash_received: 0,
        account_transfer: 0,
        total_sales: 0,
      });
    }
  }

  return buckets;
};

const getBucketIndex = (dateValue, filter) => {
  const d = new Date(dateValue);

  if (filter === "daily") {
    const day = d.getDay(); // 0 Sunday
    return day === 0 ? 6 : day - 1; // Monday first
  }

  if (filter === "weekly") {
    const day = d.getDay();
    return day === 0 ? 6 : day - 1;
  }

  if (filter === "monthly") {
    return d.getDate() - 1;
  }

  if (filter === "yearly") {
    return d.getMonth();
  }

  return -1;
};

export const getDistrictReportsAnalytics = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const districtId = req.user.organization_id;
    const filter = (req.query.filter || "daily").toLowerCase();

    if (!districtId) {
      return res.status(400).json({
        success: false,
        message: "organization_id missing in req.user",
      });
    }

    const { start, end } = getDateRange(filter);

    // 1) District ke under saare stores nikalo
    const storeWhere = {};

    if (hasAttr(Store, "district_id")) {
      storeWhere.district_id = districtId;
    } else {
      return res.status(400).json({
        success: false,
        message: "Store model me district_id field nahi mila",
      });
    }

    const districtStores = await Store.findAll({
      where: storeWhere,
      attributes: ["id", "store_name", "store_code"],
      raw: true,
    });

    const storeIds = districtStores.map((s) => s.id);

    if (!storeIds.length) {
      return res.status(200).json({
        success: true,
        message: "District reports fetched successfully",
        data: {
          filter,
          district_id: districtId,
          stores_count: 0,
          store_ids: [],
          summary: {
            total_cash_received: 0,
            account_transfer: 0,
            total_sales: 0,
          },
          cash_vs_account_reconciliation: [],
          category_wise_sales: [],
          metal_type_distribution: [],
          top_performing_products: [],
        },
      });
    }

    // 2) Dynamic field mapping
    const invoiceDateField = hasAttr(Invoice, "created_at")
      ? "created_at"
      : hasAttr(Invoice, "createdAt")
      ? "createdAt"
      : "createdAt";

    const invoiceStoreField = hasAttr(Invoice, "organization_id")
      ? "organization_id"
      : hasAttr(Invoice, "branch_id")
      ? "branch_id"
      : hasAttr(Invoice, "store_id")
      ? "store_id"
      : null;

    const invoiceTotalField = hasAttr(Invoice, "total_amount")
      ? "total_amount"
      : hasAttr(Invoice, "grand_total")
      ? "grand_total"
      : hasAttr(Invoice, "net_amount")
      ? "net_amount"
      : null;

    if (!invoiceStoreField || !invoiceTotalField) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice model me organization/store field ya total amount field nahi mila",
      });
    }

    const invoiceStatusField = hasAttr(Invoice, "status") ? "status" : null;

    const transactionDateField = hasAttr(Transaction, "created_at")
      ? "created_at"
      : hasAttr(Transaction, "createdAt")
      ? "createdAt"
      : "createdAt";

    const transactionStoreField = hasAttr(Transaction, "organization_id")
      ? "organization_id"
      : hasAttr(Transaction, "branch_id")
      ? "branch_id"
      : hasAttr(Transaction, "store_id")
      ? "store_id"
      : null;

    const transactionAmountField = hasAttr(Transaction, "amount")
      ? "amount"
      : null;

    const paymentMethodField = hasAttr(Transaction, "payment_method")
      ? "payment_method"
      : hasAttr(Transaction, "payment_mode")
      ? "payment_mode"
      : hasAttr(Transaction, "mode")
      ? "mode"
      : null;

    // 3) Sales invoices fetch
    const invoiceWhere = {
      [invoiceStoreField]: { [Op.in]: storeIds },
      [invoiceDateField]: { [Op.between]: [start, end] },
    };

    // Safe enum filtering
    if (invoiceStatusField) {
      const statusEnumValues =
        Invoice.rawAttributes?.[invoiceStatusField]?.values || [];

      const excludedStatuses = statusEnumValues.filter((status) =>
        ["CANCELLED", "cancelled", "draft", "DRAFT"].includes(status)
      );

      if (excludedStatuses.length > 0) {
        invoiceWhere[invoiceStatusField] = {
          [Op.notIn]: excludedStatuses,
        };
      }
    }

    const invoices = await Invoice.findAll({
      where: invoiceWhere,
      attributes: [
        "id",
        [col(invoiceDateField), "invoice_date"],
        [col(invoiceStoreField), "store_id"],
        [col(invoiceTotalField), "total_amount"],
        ...(invoiceStatusField ? [[col(invoiceStatusField), "status"]] : []),
      ],
      raw: true,
    });

    const invoiceIds = invoices.map((inv) => inv.id);

    // 4) Transactions fetch
    let transactions = [];

    if (transactionStoreField && transactionAmountField && paymentMethodField) {
      transactions = await Transaction.findAll({
        where: {
          [transactionStoreField]: { [Op.in]: storeIds },
          [transactionDateField]: { [Op.between]: [start, end] },
        },
        attributes: [
          "id",
          [col(transactionDateField), "transaction_date"],
          [col(transactionStoreField), "store_id"],
          [col(transactionAmountField), "amount"],
          [col(paymentMethodField), "payment_method"],
        ],
        raw: true,
      });
    }

    // 5) Summary cards
    let totalSales = 0;
    for (const inv of invoices) {
      totalSales += safeNum(inv.total_amount);
    }

    let totalCashReceived = 0;
    let totalAccountTransfer = 0;

    for (const tx of transactions) {
      const mode = String(tx.payment_method || "").toLowerCase();
      const amt = safeNum(tx.amount);

      if (["cash"].includes(mode)) {
        totalCashReceived += amt;
      } else if (
        ["bank", "account", "account_transfer", "upi", "online", "card"].includes(
          mode
        )
      ) {
        totalAccountTransfer += amt;
      }
    }

    // 6) Cash vs Account Reconciliation
    const chartBuckets = buildBuckets(filter, start);

    for (const inv of invoices) {
      const idx = getBucketIndex(inv.invoice_date, filter);
      if (idx >= 0 && chartBuckets[idx]) {
        chartBuckets[idx].total_sales += safeNum(inv.total_amount);
      }
    }

    for (const tx of transactions) {
      const idx = getBucketIndex(tx.transaction_date, filter);
      if (idx >= 0 && chartBuckets[idx]) {
        const mode = String(tx.payment_method || "").toLowerCase();
        const amt = safeNum(tx.amount);

        if (["cash"].includes(mode)) {
          chartBuckets[idx].cash_received += amt;
        } else if (
          ["bank", "account", "account_transfer", "upi", "online", "card"].includes(
            mode
          )
        ) {
          chartBuckets[idx].account_transfer += amt;
        }
      }
    }

    // 7) Category-wise Sales + Metal Type + Top Products
    let categoryWiseSales = [];
    let metalTypeDistribution = [];
    let topPerformingProducts = [];

    if (invoiceIds.length > 0) {
      // Category-wise sales
      categoryWiseSales = await sequelize.query(
        `
        SELECT
          COALESCE(category, 'Others') AS category,
          COALESCE(SUM(total_amount), 0) AS revenue,
          COUNT(*) AS units_sold
        FROM invoice_items
        WHERE invoice_id IN (:invoiceIds)
        GROUP BY category
        ORDER BY revenue DESC
        `,
        {
          replacements: { invoiceIds },
          type: QueryTypes.SELECT,
        }
      );

      // Metal-type distribution
      metalTypeDistribution = await sequelize.query(
        `
        SELECT
          CASE
            WHEN purity IS NOT NULL AND purity <> '' AND metal_type IS NOT NULL AND metal_type <> ''
              THEN CONCAT(metal_type, ' ', purity)
            WHEN metal_type IS NOT NULL AND metal_type <> ''
              THEN metal_type
            ELSE 'Unknown'
          END AS metal_label,
          COALESCE(SUM(total_amount), 0) AS revenue,
          COUNT(*) AS units_sold
        FROM invoice_items
        WHERE invoice_id IN (:invoiceIds)
        GROUP BY metal_type, purity
        ORDER BY revenue DESC
        `,
        {
          replacements: { invoiceIds },
          type: QueryTypes.SELECT,
        }
      );

      // Top performing products
      topPerformingProducts = await sequelize.query(
        `
        SELECT
          COALESCE(product_name, description, product_code, 'Item') AS product_name,
          COALESCE(category, 'Others') AS category,
          COUNT(*) AS units_sold,
          COALESCE(SUM(total_amount), 0) AS total_revenue
        FROM invoice_items
        WHERE invoice_id IN (:invoiceIds)
        GROUP BY product_name, description, product_code, category
        ORDER BY total_revenue DESC
        LIMIT 5
        `,
        {
          replacements: { invoiceIds },
          type: QueryTypes.SELECT,
        }
      );

      const maxRevenue = topPerformingProducts.length
        ? Math.max(...topPerformingProducts.map((p) => safeNum(p.total_revenue)))
        : 0;

      topPerformingProducts = topPerformingProducts.map((p, index) => ({
        rank: index + 1,
        product_name: p.product_name || "Item",
        category: p.category || "Others",
        units_sold: safeNum(p.units_sold),
        total_revenue: safeNum(p.total_revenue),
        performance:
          maxRevenue > 0
            ? Math.round((safeNum(p.total_revenue) / maxRevenue) * 100)
            : 0,
      }));
    }

    return res.status(200).json({
      success: true,
      message: "District reports fetched successfully",
      data: {
        filter,
        district_id: districtId,
        stores_count: storeIds.length,
        store_ids: storeIds,
        summary: {
          total_cash_received: totalCashReceived,
          account_transfer: totalAccountTransfer,
          total_sales: totalSales,
        },
        cash_vs_account_reconciliation: chartBuckets,
        category_wise_sales: categoryWiseSales.map((row) => ({
          category: row.category || "Others",
          revenue: safeNum(row.revenue),
          units_sold: safeNum(row.units_sold),
        })),
        metal_type_distribution: metalTypeDistribution.map((row) => ({
          metal_type: row.metal_label || "Unknown",
          revenue: safeNum(row.revenue),
          units_sold: safeNum(row.units_sold),
        })),
        top_performing_products: topPerformingProducts,
      },
    });
  } catch (error) {
    console.error("getDistrictReportsAnalytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch district reports analytics",
      error: error.message,
    });
  }
};





