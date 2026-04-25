import sequelize from "../config/db.js";
import { QueryTypes } from "sequelize";
import redis from "../config/redis.js";

/**
 * ==========================================
 * 1. DASHBOARD ANALYTICS
 * ==========================================
 */
export const getDashboardAnalytics = async (req, res) => {
  try {
    const cacheKey = "dashboard:analytics";

    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("⚡ Cache Hit: Dashboard Analytics");
      return res.json(JSON.parse(cached));
    }

    console.log("🐢 Cache Miss: Dashboard Analytics");

    // TOTAL REVENUE
    const revenueResult = await sequelize.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total_revenue
      FROM invoices
      WHERE status IN ('PAID', 'PARTIAL')
    `, { type: QueryTypes.SELECT });

    // TOTAL PROFIT
    const profitResult = await sequelize.query(`
      SELECT COALESCE(
        SUM(
          ii.total_amount - (
            (COALESCE(i.purchase_rate, 0) * COALESCE(ii.net_weight, 0)) + 
            COALESCE(i.making_charge, 0) + 
            COALESCE(i.stone_amount, 0)
          )
        ), 0
      ) AS total_profit
      FROM invoice_items ii
      JOIN items i ON i.id = ii.item_id
      JOIN invoices inv ON inv.id = ii.invoice_id
      WHERE inv.status IN ('PAID', 'PARTIAL')
    `, { type: QueryTypes.SELECT });

    // INVENTORY COUNT
    const inventoryResult = await sequelize.query(`
      SELECT COUNT(*) AS total_inventory FROM items
    `, { type: QueryTypes.SELECT });

    // AVG MONTHLY SALES
    const avgSalesResult = await sequelize.query(`
      SELECT COALESCE(AVG(monthly_sales), 0) AS avg_sales FROM (
        SELECT DATE_TRUNC('month', invoice_date) AS month,
               SUM(total_amount) AS monthly_sales
        FROM invoices
        WHERE status IN ('PAID', 'PARTIAL')
        GROUP BY month
      ) AS monthly_data
    `, { type: QueryTypes.SELECT });

    const data = {
      totalRevenue: Number(revenueResult[0].total_revenue),
      totalProfit: Number(profitResult[0].total_profit),
      totalInventory: Number(inventoryResult[0].total_inventory),
      avgMonthlySales: Number(avgSalesResult[0].avg_sales)
    };

    await redis.set(cacheKey, JSON.stringify({ success: true, data }), "EX", 60);

    res.json({ success: true, data });

  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * ==========================================
 * 2. MONTHLY SALES & PROFIT
 * ==========================================
 */
export const getMonthlySalesProfit = async (req, res) => {
  try {
    const cacheKey = "dashboard:monthly";

    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("⚡ Cache Hit: Monthly");
      return res.json(JSON.parse(cached));
    }

    console.log("🐢 Cache Miss: Monthly");

    const data = await sequelize.query(`
      SELECT 
        TO_CHAR(inv.invoice_date, 'Mon') AS month,
        DATE_TRUNC('month', inv.invoice_date) AS full_date,
        SUM(inv.total_amount) AS sales,
        SUM(
          ii.total_amount - (
            (COALESCE(i.purchase_rate, 0) * COALESCE(ii.net_weight, 0)) + 
            COALESCE(i.making_charge, 0) + 
            COALESCE(i.stone_amount, 0)
          )
        ) AS profit
      FROM invoices inv
      JOIN invoice_items ii ON inv.id = ii.invoice_id
      JOIN items i ON i.id = ii.item_id
      WHERE inv.status IN ('PAID', 'PARTIAL')
      GROUP BY month, full_date
      ORDER BY full_date ASC
    `, { type: QueryTypes.SELECT });

    const formatted = data.map(item => ({
      label: item.month,
      sales: Number(item.sales),
      profit: Number(item.profit)
    }));

    await redis.set(cacheKey, JSON.stringify({ success: true, data: formatted }), "EX", 60);

    res.json({ success: true, data: formatted });

  } catch (error) {
    console.error("Monthly Trend Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * ==========================================
 * 3. CATEGORY WISE SALES (FIXED 🔥)
 * ==========================================
 */
export const getCategoryWiseSales = async (req, res) => {
  try {
    const cacheKey = "dashboard:category_sales";

    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(" Cache Hit: Category Sales");
      return res.json(JSON.parse(cached));
    }

    console.log(" Cache Miss: Category Sales");

    const data = await sequelize.query(`
      WITH category_data AS (
        SELECT 
          LOWER(TRIM(i.category)) AS category,
          SUM(ii.total_amount) AS total_sales
        FROM invoice_items ii
        JOIN items i ON i.id = ii.item_id
        JOIN invoices inv ON inv.id = ii.invoice_id
        WHERE inv.status IN ('PAID', 'PARTIAL')
        GROUP BY LOWER(TRIM(i.category))
      )
      SELECT 
        category,
        total_sales AS value,
        ROUND((total_sales * 100.0 / SUM(total_sales) OVER()), 0) AS percentage
      FROM category_data
      ORDER BY total_sales DESC
    `, { type: QueryTypes.SELECT });

    await redis.set(cacheKey, JSON.stringify({ success: true, data }), "EX", 60);

    res.json({ success: true, data });

  } catch (error) {
    console.error("Category Sales Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * ==========================================
 * 4. METAL DISTRIBUTION
 * ==========================================
 */
export const getMetalDistribution = async (req, res) => {
  try {
    const cacheKey = "dashboard:metal_distribution";

    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("⚡ Cache Hit: Metal Distribution");
      return res.json(JSON.parse(cached));
    }

    console.log("🐢 Cache Miss: Metal Distribution");

    const data = await sequelize.query(`
      SELECT 
        CONCAT(i.metal_type, ' ', i.purity) AS label,
        SUM(ii.total_amount) AS revenue
      FROM invoice_items ii
      JOIN items i ON i.id = ii.item_id
      JOIN invoices inv ON inv.id = ii.invoice_id
      WHERE inv.status IN ('PAID', 'PARTIAL')
      GROUP BY i.metal_type, i.purity
      ORDER BY revenue DESC
    `, { type: QueryTypes.SELECT });

    const formatted = data.map(item => ({
      label: item.label,
      value: Number(item.revenue)
    }));

    await redis.set(cacheKey, JSON.stringify({ success: true, data: formatted }), "EX", 300);

    res.json({ success: true, data: formatted });

  } catch (error) {
    console.error("Metal Distribution Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * ==========================================
 * 5. TOP PRODUCTS
 * ==========================================
 */
export const getTopProducts = async (req, res) => {
  try {
    const cacheKey = "dashboard:top_products_units";

    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("⚡ Cache Hit: Top Products (Units)");
      return res.json(JSON.parse(cached));
    }

    console.log("🐢 Cache Miss: Top Products (Units)");

    const data = await sequelize.query(`
      SELECT 
        i.item_name,
        i.category,
        COUNT(ii.id) as units_sold,
        COALESCE(SUM(ii.total_amount), 0) as total_revenue
      FROM invoice_items ii
      JOIN items i ON i.id = ii.item_id
      JOIN invoices inv ON ii.invoice_id = inv.id
      WHERE inv.status IN ('PAID', 'PARTIAL')
      GROUP BY i.id, i.item_name, i.category
      ORDER BY units_sold DESC, total_revenue DESC   -- 🔥 KEY CHANGE
      LIMIT 5
    `, { type: QueryTypes.SELECT });

    // 🔥 Performance now based on units (not revenue)
    const maxUnits = data.length ? Number(data[0].units_sold) : 0;

    const finalData = data.map((item, index) => ({
      rank: index + 1,
      product_name: item.item_name,
      category: item.category,
      units_sold: Number(item.units_sold),
      total_revenue: Number(item.total_revenue),
      performance: maxUnits
        ? Math.round((item.units_sold / maxUnits) * 100)
        : 0,
    }));

    await redis.set(
      cacheKey,
      JSON.stringify({ success: true, data: finalData }),
      "EX",
      30   // 30 seconds cache
    );

    res.json({ success: true, data: finalData });

  } catch (error) {
    console.error("Top Products Error:", error);
    res.status(500).json({ error: error.message });
  }
};


/**
 * ==========================================
 * 6. DAILY SALES TREND
 * ==========================================
 */
export const getDailySalesTrend = async (req, res) => {
  try {
    const cacheKey = "dashboard:daily_trend";

    // const cached = await redis.get(cacheKey);
    // if (cached) {
    //   console.log("⚡ Cache Hit: Daily Trend");
    //   return res.json(JSON.parse(cached));
    // }

    // console.log("🐢 Cache Miss: Daily Trend");

    const data = await sequelize.query(`
      WITH dates AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '29 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS date
      )
      SELECT 
        d.date,
        COALESCE(SUM(inv.total_amount), 0) AS sales
      FROM dates d
      LEFT JOIN invoices inv
        ON DATE(inv.invoice_date) = d.date
        AND inv.status IN ('PAID', 'PARTIAL')
      GROUP BY d.date
      ORDER BY d.date ASC
    `, { type: QueryTypes.SELECT });

    const formatted = data.map(item => ({
      label: item.date,   // date 그대로 (frontend format kare)
      sales: Number(item.sales)
    }));

    await redis.set(
      cacheKey,
      JSON.stringify({ success: true, data: formatted }),
      "EX",
      60   // 🔥 1 min cache (dynamic data)
    );

    res.json({ success: true, data: formatted });

  } catch (error) {
    console.error("Daily Trend Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};