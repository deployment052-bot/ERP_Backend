import { Op, fn, col, literal } from "sequelize";
import Item from "../model/item.js";

// Apne actual models ke path yaha set karna
import StockMovement from "../model/stockmovement.js";
// import Invoice from "../model/invoice.js";
import SystemActivity from "../model/systemActivity.js";
import Task from "../model/task.js";
import MetalRate from "../model/metalRate.js";

const getScopeWhere = (user) => {
  const {
    role,
    organization_level,
    state_code,
    district_code,
    store_code,
  } = user || {};

  // super admin / central
  if (
    role === "super_admin" ||
    role === "capital" ||
    organization_level === "central"
  ) {
    return {};
  }

  // state level
  if (role === "state_manager" || organization_level === "state") {
    return { state_code };
  }

  // district level
  if (role === "district_manager" || organization_level === "district") {
    return { district_code };
  }

  // store level
  if (
    ["manager", "admin", "sales_girl"].includes(role) ||
    organization_level === "store"
  ) {
    return { store_code };
  }

  return null;
};

export const getDashboardSummary = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const scopeWhere = getScopeWhere(req.user);

    if (scopeWhere === null) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view dashboard",
      });
    }

    // -------------------------------
    // 1) TOTAL STOCK
    // -------------------------------
    const totalStock = await Item.count({
      where: {
        ...scopeWhere,
        current_status: "in_stock",
      },
    });

    // -------------------------------
    // 2) DEAD STOCK
    // Assumption:
    // dead stock = dead_stock / unsold / no movement
    // adjust according to your DB
    // -------------------------------
    const deadStockItems = await Item.count({
      where: {
        ...scopeWhere,
        current_status: "dead_stock",
      },
    });

    // -------------------------------
    // 3) TRANSIT GOODS
    // -------------------------------
    const transitGoods = await Item.count({
      where: {
        ...scopeWhere,
        current_status: "in_transit",
      },
    });

    // -------------------------------
    // 4) GOLD / SILVER PRICE
    // Assumption: MetalRate table exists
    // latest rate by metal_type
    // -------------------------------
    const goldRate = await MetalRate.findOne({
      where: { metal_type: "Gold" },
      order: [["created_at", "DESC"]],
    });

    const silverRate = await MetalRate.findOne({
      where: { metal_type: "Silver" },
      order: [["created_at", "DESC"]],
    });

    // -------------------------------
    // 5) SALES TRENDS (last 7 days)
    // Assumption: Invoice has created_at + total_amount
    // -------------------------------
    // const sevenDaysAgo = new Date();
    // sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    // const salesTrendRaw = await Invoice.findAll({
    //   attributes: [
    //     [fn("DATE", col("created_at")), "date"],
    //     [fn("COUNT", col("id")), "count"],
    //     [fn("COALESCE", fn("SUM", col("total_amount")), 0), "amount"],
    //   ],
    //   where: {
    //     ...scopeWhere,
    //     created_at: {
    //       [Op.gte]: sevenDaysAgo,
    //     },
    //   },
    //   group: [fn("DATE", col("created_at"))],
    //   order: [[fn("DATE", col("created_at")), "ASC"]],
    //   raw: true,
    // });

    // const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    // const salesTrends = salesTrendRaw.map((row) => {
    //   const d = new Date(row.date);
    //   return {
    //     day: dayMap[d.getDay()],
    //     date: row.date,
    //     count: Number(row.count || 0),
    //     amount: Number(row.amount || 0),
    //   };
    // });

    // -------------------------------
    // 6) SALES BY CATEGORY
    // Assumption: Item.category linked with sold invoices/items
    // If you have InvoiceItem model use that instead
    // -------------------------------
    const salesByCategoryRaw = await Item.findAll({
      attributes: [
        "category",
        [fn("COUNT", col("id")), "count"],
      ],
      where: {
        ...scopeWhere,
        current_status: "sold",
      },
      group: ["category"],
      order: [[literal("count"), "DESC"]],
      raw: true,
    });

    const totalCategoryCount = salesByCategoryRaw.reduce(
      (sum, row) => sum + Number(row.count || 0),
      0
    );

    const salesByCategory = salesByCategoryRaw.map((row) => ({
      category: row.category || "Other",
      count: Number(row.count || 0),
      percentage:
        totalCategoryCount > 0
          ? Number(((Number(row.count) / totalCategoryCount) * 100).toFixed(2))
          : 0,
    }));

    // -------------------------------
    // 7) PENDING TASKS
    // -------------------------------
    const pendingTasks = await Task.findAll({
      where: {
        ...scopeWhere,
        status: "pending",
      },
      order: [["created_at", "DESC"]],
      limit: 5,
      raw: true,
    });

    // -------------------------------
    // 8) RECENT ACTIVITIES
    // -------------------------------
    const recentActivities = await SystemActivity.findAll({
      where: scopeWhere,
      order: [["created_at", "DESC"]],
      limit: 5,
      raw: true,
    });

    return res.status(200).json({
      success: true,
      message: "Dashboard fetched successfully",
      data: {
        cards: {
          total_stock: totalStock,
          dead_stock_items: deadStockItems,
          transit_goods: transitGoods,
          gold_price: goldRate ? Number(goldRate.rate) : 0,
          silver_price: silverRate ? Number(silverRate.rate) : 0,
        },
        // charts: {
        //   sales_trends: salesTrends,
        //   sales_by_category: salesByCategory,
        // },
        pending_tasks: pendingTasks,
        recent_activities: recentActivities,
      },
    });
  } catch (error) {
    console.error("Dashboard Summary Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard",
      error: error.message,
    });
  }
};