import sequelize from "../config/db.js";
import { Op } from "sequelize";
import Store from "../model/Store.js";
import Stock from "../model/stockrecord.js";
import Item from "../model/item.js";
import StockTransfer from "../model/stockTransfer.js";
import StockTransferItem from "../model/stockTransferItem.js";
import ActivityLog from "../model/activityLog.js";



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