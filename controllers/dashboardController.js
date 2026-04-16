import sequelize from "../config/db.js";
import { QueryTypes } from "sequelize";
import axios from "axios";

export const getDashboardAdvanced = async (req, res) => {
  try {

    // ===== STOCK STATUS (1 QUERY) =====
    const [stockStatus] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_stock,
        COUNT(*) FILTER (WHERE is_active = true) as active_stock,
        COUNT(*) FILTER (WHERE is_active = false) as dead_stock
      FROM items
    `, { type: QueryTypes.SELECT });

    // ===== STOCK VALUE =====
    const [stockValue] = await sequelize.query(`
      SELECT COALESCE(SUM(total_amount),0) as total FROM invoice_items
    `, { type: QueryTypes.SELECT });

    // ===== TRANSIT =====
    const [transitStock] = await sequelize.query(`
      SELECT COALESCE(SUM(transit_qty),0) as total FROM stocks
    `, { type: QueryTypes.SELECT });

    // ===== METAL REVENUE (1 QUERY) =====
    const metalRevenue = await sequelize.query(`
      SELECT 
        i.metal_type,
        SUM(ii.total_amount) as total
      FROM invoice_items ii
      JOIN items i ON i.id = ii.item_id
      GROUP BY i.metal_type
    `, { type: QueryTypes.SELECT });

    let goldRevenue = 0, silverRevenue = 0;
    metalRevenue.forEach(m => {
      if (m.metal_type === 'Gold') goldRevenue = m.total;
      if (m.metal_type === 'Silver') silverRevenue = m.total;
    });

    // ===== SALES + REVENUE (COMBINED) =====
    const trends = await sequelize.query(`
      SELECT 
        TO_CHAR(inv.invoice_date, 'Mon') as label,
        COUNT(inv.id) as sales_count,
        SUM(inv.total_amount) as revenue,
        SUM(inv.received_amount) as received
      FROM invoices inv
      GROUP BY label
      ORDER BY MIN(inv.invoice_date)
    `, { type: QueryTypes.SELECT });

    // ===== RECENT =====
    const recentActivities = await sequelize.query(`
      SELECT 
        inv.invoice_number,
        inv."createdAt"
      FROM invoices inv
      ORDER BY inv."createdAt" DESC
      LIMIT 5
    `, { type: QueryTypes.SELECT });

    // ===== FINAL =====
    res.json({
      success: true,
      data: {
        cards: {
          totalStock: stockStatus.total_stock,
          activeStock: stockStatus.active_stock,
          deadStock: stockStatus.dead_stock,
          stockValue: stockValue.total,
          transitStock: transitStock.total,
          goldRevenue,
          silverRevenue
        },
        trends,
        recentActivities
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const getDashboardCards = async (req, res) => {
  try {

    // =========================
    // 1. TOTAL STOCK
    // =========================
    const [totalStock] = await sequelize.query(`
      SELECT COUNT(*) as total FROM items
    `, { type: QueryTypes.SELECT });

    // =========================
    // 2. STOCK VALUE
    // =========================
const [stockValue] = await sequelize.query(`
  SELECT 
    COALESCE(SUM(s.available_qty * i.purchase_rate), 0) as total
  FROM stocks s
  JOIN items i ON i.id = s.item_id
`, { type: QueryTypes.SELECT });
    // =========================
    // 3. DEAD STOCK (30 DAYS) ✅ FIXED
    // =========================
    const [stockData] = await sequelize.query(`
      SELECT 
        COUNT(*) FILTER (
          WHERE created_at < NOW() - INTERVAL '30 days'
        ) as dead_stock,
        COUNT(*) as total_stock
      FROM items
    `, { type: QueryTypes.SELECT });

    const deadStockPercent = stockData.total_stock > 0
      ? ((stockData.dead_stock / stockData.total_stock) * 100).toFixed(2)
      : 0;
     // 2.5 TRANSIT STOCK ✅ NEW
// =========================
const [transitStock] = await sequelize.query(`
  SELECT COALESCE(SUM(transit_qty), 0) as total 
  FROM stocks
`, { type: QueryTypes.SELECT });
    // =========================
    // 4. GOLD & SILVER PRICE
    // =========================
    const getMetalPrice = async (metal) => {
      const today = await axios.get(`https://www.goldapi.io/api/${metal}/INR`, {
        headers: { "x-access-token": process.env.GOLD_API_KEY }
      });

      const yesterday = await axios.get(`https://www.goldapi.io/api/${metal}/INR?date=yesterday`, {
        headers: { "x-access-token": process.env.GOLD_API_KEY }
      });

      const todayPrice = today.data.price;
      const yesterdayPrice = yesterday.data.price;

      const percent = (((todayPrice - yesterdayPrice) / yesterdayPrice) * 100).toFixed(2);

      return {
        price: todayPrice,
        percentage: percent
      };
    };

    const gold = await getMetalPrice("XAU");
    const silver = await getMetalPrice("XAG");

    // =========================
    // FINAL RESPONSE
    // =========================
    res.json({
      success: true,
      data: {
        totalStock: Number(totalStock.total),
        stockValue: Number(stockValue.total),
         
        deadStock: {
          count: Number(stockData.dead_stock),
          percentage: deadStockPercent + "%"
        },
        transitStock: Number(transitStock.total),
        gold: {
          price: gold.price,
          percentage: gold.percentage + "%"
        },

        silver: {
          price: silver.price,
          percentage: silver.percentage + "%"
        }
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
export const getSalesPurchaseTrend = async (req, res) => {
  try {
    const { filter = "monthly" } = req.query;

    let dateFormat = "";
    let salesDateField = "inv.invoice_date";
    let purchaseDateField = "i.created_at";

    // =========================
    // FILTER LOGIC
    // =========================
    if (filter === "daily") {
      dateFormat = "YYYY-MM-DD";
    } else if (filter === "weekly") {
      dateFormat = "IYYY-IW"; // ISO Week
    } else {
      dateFormat = "Mon"; // Monthly
    }

    // =========================
    // SALES (Invoices)
    // =========================
    const sales = await sequelize.query(`
      SELECT 
        TO_CHAR(${salesDateField}, '${dateFormat}') as label,
        COUNT(*) as sales
      FROM invoices inv
      GROUP BY label
      ORDER BY MIN(${salesDateField})
    `, { type: QueryTypes.SELECT });

    // =========================
    // PURCHASE (Items created)
    // =========================
    const purchase = await sequelize.query(`
      SELECT 
        TO_CHAR(${purchaseDateField}, '${dateFormat}') as label,
        COUNT(*) as purchase
      FROM items i
      GROUP BY label
      ORDER BY MIN(${purchaseDateField})
    `, { type: QueryTypes.SELECT });

    // =========================
    // MERGE DATA
    // =========================
    const map = {};

    sales.forEach(s => {
      map[s.label] = {
        label: s.label,
        sales: Number(s.sales),
        purchase: 0
      };
    });

    purchase.forEach(p => {
      if (!map[p.label]) {
        map[p.label] = {
          label: p.label,
          sales: 0,
          purchase: Number(p.purchase)
        };
      } else {
        map[p.label].purchase = Number(p.purchase);
      }
    });

    const finalData = Object.values(map);

    // =========================
    // RESPONSE
    // =========================
    res.json({
      success: true,
      data: finalData
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
export const getProfitLoss = async (req, res) => {
  try {

    // =========================
    // SALES (Invoices)
    // =========================
    const salesData = await sequelize.query(`
      SELECT 
        TO_CHAR(invoice_date, 'YYYY-MM') as label,
        COALESCE(SUM(total_amount),0) as sales
      FROM invoices
      WHERE invoice_date IS NOT NULL
      GROUP BY label
      ORDER BY label
    `, { type: QueryTypes.SELECT });

    // =========================
    // PURCHASE (Items as workaround)
    // =========================
    const purchaseData = await sequelize.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as label,
        COALESCE(SUM(purchase_rate),0) as purchase
      FROM items
      WHERE created_at IS NOT NULL
      GROUP BY label
      ORDER BY label
    `, { type: QueryTypes.SELECT });

    // =========================
    // MERGE + CALCULATE
    // =========================
    const map = {};

    // Sales insert
    salesData.forEach(s => {
      map[s.label] = {
        label: s.label,
        profit: Number(s.sales),
        loss: 0
      };
    });

    // Purchase adjust
    purchaseData.forEach(p => {
      if (!map[p.label]) {
        map[p.label] = {
          label: p.label,
          profit: 0,
          loss: Number(p.purchase)
        };
      } else {
        const profitValue = map[p.label].profit - Number(p.purchase);

        if (profitValue >= 0) {
          map[p.label].profit = profitValue;
          map[p.label].loss = 0;
        } else {
          map[p.label].profit = 0;
          map[p.label].loss = Math.abs(profitValue);
        }
      }
    });

    // =========================
    // FINAL RESPONSE
    // =========================
    res.json({
      success: true,
      data: Object.values(map)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
export const getRevenueTrend = async (req, res) => {
  try {

    const data = await sequelize.query(`
      SELECT 
        TO_CHAR(invoice_date, 'Mon') as label,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM invoices
      WHERE status IN ('PAID', 'PARTIAL')
        AND invoice_date IS NOT NULL
      GROUP BY label
      ORDER BY MIN(invoice_date)
    `, { type: QueryTypes.SELECT });

    // Convert to number (important)
    const formattedData = data.map(d => ({
      label: d.label,
      revenue: Number(d.revenue)
    }));

    res.json({
      success: true,
      data: formattedData
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
export const getRecentActivities = async (req, res) => {
  try {

    // SALES
    const sales = await sequelize.query(`
      SELECT 
        'Sales Transaction' as title,
        CONCAT('Sale completed - ₹', total_amount) as description,
        "createdAt" as time   -- ✅ FIX
      FROM invoices
      ORDER BY "createdAt" DESC
      LIMIT 3
    `, { type: QueryTypes.SELECT });

    // STOCK UPDATE
    const stockUpdates = await sequelize.query(`
      SELECT 
        'Stock Updated' as title,
        'Inventory updated' as description,
        updated_at as time   -- ✅ FIX
      FROM stocks
      ORDER BY updated_at DESC
      LIMIT 2
    `, { type: QueryTypes.SELECT });

    // TRANSIT (CHECK YOUR TABLE NAME)
    const transit = await sequelize.query(`
      SELECT 
        'Transit Item' as title,
        'Items moved between stores' as description,
        created_at as time   -- ✅ only if exists
      FROM stock_transfer
      ORDER BY created_at DESC
      LIMIT 2
    `, { type: QueryTypes.SELECT });

    // MERGE
    const activities = [...sales, ...stockUpdates, ...transit];

    // SORT
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    // LIMIT 5
    const finalData = activities.slice(0, 5);

    res.json({
      success: true,
      data: finalData
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};