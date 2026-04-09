import { Op } from "sequelize";
import Item from "../model/item.js";
import Stock from "../model/stockrecord.js";
import Store from "../model/Store.js";

export const getStockList = async (req, res) => {
  try {
    const user = req.user;
    const {
      metal_type,
      category,
      status,
      search,
      organization_id,
      page = 1,
      limit = 20,
      group_by_category = "true",
    } = req.query;

    const orgId = getOrganizationFilter(user, organization_id);

    const itemWhere = {};
    const stockWhere = {};

    if (orgId) {
      itemWhere.organization_id = orgId;
      stockWhere.organization_id = orgId;
    }

    if (metal_type) itemWhere.metal_type = metal_type;
    if (category) itemWhere.category = category;
    if (status) itemWhere.current_status = status;

    if (search) {
      itemWhere[Op.or] = [
        { item_name: { [Op.iLike]: `%${search}%` } },
        { article_code: { [Op.iLike]: `%${search}%` } },
        { sku_code: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } },
        { purity: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.max(Number(limit) || 20, 1);
    const offset = (pageNum - 1) * limitNum;

    const { count, rows } = await Item.findAndCountAll({
      attributes: [
        "id",
        "item_name",
        "article_code",
        "sku_code",
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
      ],
      where: itemWhere,
      include: [
        {
          model: Stock,
          as: "stocks",
          required: false,
          where: Object.keys(stockWhere).length ? stockWhere : undefined,
          attributes: [
            "id",
            "available_qty",
            "available_weight",
            "reserved_qty",
            "transit_qty",
            "damaged_qty",
            "dead_qty",
          ],
        },
        {
          model: Store,
          as: "organization",
          required: false,
          attributes: ["id", "store_code", "store_name", "organization_level"],
        },
      ],
      order: [["id", "DESC"]],
      limit: limitNum,
      offset,
      distinct: true,
      subQuery: false,
    });

    // =========================
    // FLAT CLEAN DATA
    // =========================
    const flatData = rows.map((item) => {
      const stock =
        Array.isArray(item.stocks) && item.stocks.length > 0
          ? item.stocks[0]
          : null;

      return {
        id: Number(item.id || 0),
        item_name: item.item_name || "",
        code: item.article_code || "",
        sku_code: item.sku_code || "",
        metal_type: item.metal_type || "",
        category: item.category || "",
        details: item.details || "",
        purity: item.purity || "",
        gross_weight: Number(item.gross_weight || 0),
        net_weight: Number(item.net_weight || 0),
        stone_weight: Number(item.stone_weight || 0),
        stone_amount: Number(item.stone_amount || 0),
        making_charge: Number(item.making_charge || 0),
        purchase_rate: Number(item.purchase_rate || 0),
        selling_price: Number(item.sale_rate || 0),
        hsn_code: item.hsn_code || "",
        unit: item.unit || "",
        current_status: item.current_status || "",
        organization_id: Number(item.organization_id || 0),

        // 👇 sirf quantity / summary fields
        quantity: Number(stock?.available_qty || 0),
        available_weight: Number(stock?.available_weight || 0),
        reserved_qty: Number(stock?.reserved_qty || 0),
        transit_qty: Number(stock?.transit_qty || 0),
        damaged_qty: Number(stock?.damaged_qty || 0),
        dead_qty: Number(stock?.dead_qty || 0),

        organization: item.organization
          ? {
              id: Number(item.organization.id || 0),
              store_code: item.organization.store_code || "",
              store_name: item.organization.store_name || "",
              organization_level: item.organization.organization_level || "",
            }
          : null,

        action: "View",
      };
    });

    // =========================
    // CATEGORY GROUPED RESPONSE
    // =========================
    if (String(group_by_category).toLowerCase() === "true") {
      const groupedMap = {};

      for (const item of flatData) {
        const categoryKey = item.category || "Other";

        if (!groupedMap[categoryKey]) {
          groupedMap[categoryKey] = {
            category: categoryKey,
            total_items: 0,
            total_qty: 0,
            total_available_weight: 0,
            total_reserved_qty: 0,
            total_transit_qty: 0,
            total_damaged_qty: 0,
            total_dead_qty: 0,
            items: [],
          };
        }

        groupedMap[categoryKey].total_items += 1;
        groupedMap[categoryKey].total_qty += Number(item.quantity || 0);
        groupedMap[categoryKey].total_available_weight += Number(item.available_weight || 0);
        groupedMap[categoryKey].total_reserved_qty += Number(item.reserved_qty || 0);
        groupedMap[categoryKey].total_transit_qty += Number(item.transit_qty || 0);
        groupedMap[categoryKey].total_damaged_qty += Number(item.damaged_qty || 0);
        groupedMap[categoryKey].total_dead_qty += Number(item.dead_qty || 0);

        groupedMap[categoryKey].items.push(item);
      }

      const groupedData = Object.values(groupedMap).map((group, index) => ({
        idx: index,
        category: group.category,
        total_items: group.total_items,
        total_qty: Number(group.total_qty.toFixed(3)),
        total_available_weight: Number(group.total_available_weight.toFixed(3)),
        total_reserved_qty: Number(group.total_reserved_qty.toFixed(3)),
        total_transit_qty: Number(group.total_transit_qty.toFixed(3)),
        total_damaged_qty: Number(group.total_damaged_qty.toFixed(3)),
        total_dead_qty: Number(group.total_dead_qty.toFixed(3)),
        items: group.items,
      }));

      return res.status(200).json({
        success: true,
        message: "Stock list fetched successfully",
        view_type: "category_grouped",
        pagination: {
          total: count,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(count / limitNum),
        },
        count: groupedData.length,
        raw_count: flatData.length,
        data: groupedData,
      });
    }

    // =========================
    // FLAT RESPONSE
    // =========================
    return res.status(200).json({
      success: true,
      message: "Stock list fetched successfully",
      view_type: "flat",
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
      count: flatData.length,
      data: flatData,
    });
  } catch (error) {
    console.error("getStockList error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock list",
      error: error.message,
    });
  }
};