import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";
import Payment from "../models/Payment.js";
import LedgerEntry from "../models/LedgerEntry.js";
import Item from "../models/Item.js";
import sequelize from "../config/db.js";
import { Op } from "sequelize";

// ================= DASHBOARD SUMMARY =================
export const getDashboardSummary = async (req, res) => {
  try {
    const totalCustomers = await Customer.count();

    const totalRevenue = await Invoice.sum("total_amount") || 0;

    const totalSales = await Invoice.count();

    res.json({
      success: true,
      data: {
        totalCustomers,
        totalRevenue,
        totalSales,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// ================= CASH vs ACCOUNT =================
export const getCashVsAccount = async (req, res) => {
  try {
    const data = await sequelize.query(`
      SELECT 
        DATE(p.payment_date) as date,
        TO_CHAR(p.payment_date, 'Dy') as day,

        SUM(CASE WHEN p.payment_method = 'CASH' THEN p.amount ELSE 0 END) as cash,
        SUM(CASE WHEN p.payment_method != 'CASH' THEN p.amount ELSE 0 END) as online,
        SUM(p.amount) as total

      FROM payments p

      GROUP BY 
        DATE(p.payment_date),
        TO_CHAR(p.payment_date, 'Dy')   -- 🔥 IMPORTANT FIX

      ORDER BY DATE(p.payment_date) ASC
    `, { type: sequelize.QueryTypes.SELECT });

    res.json({ success: true, data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// ================= CATEGORY SALES =================
export const getCategorySales = async (req, res) => {
  try {
    const data = await sequelize.query(`
      SELECT 
        i.category,
        SUM(ii.total_amount) as total_revenue
      FROM invoice_items ii
      JOIN items i 
        ON i.id = ii.item_id   -- ✅ FIXED (IMPORTANT)
      JOIN invoices inv 
        ON ii.invoice_id = inv.id
      WHERE inv.status IN ('PAID', 'PARTIAL')
      GROUP BY i.category
    `, { type: sequelize.QueryTypes.SELECT });

    // 🔥 Total
    const total = data.reduce(
      (sum, item) => sum + Number(item.total_revenue),
      0
    );

    // 🔥 Percentage
    const finalData = data.map(item => ({
      category: item.category,
      percentage: total
        ? Number(((item.total_revenue / total) * 100).toFixed(0))
        : 0,
    }));

    res.json({ success: true, data: finalData });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ================= TYPE DISTRIBUTION =================
export const getTypeDistribution = async (req, res) => {
  try {
    const data = await sequelize.query(`
      SELECT 
        CONCAT(i.metal_type, ' ', i.purity) as label,
        SUM(ii.total_amount) as value
      FROM invoice_items ii
      JOIN items i ON i.id = ii.item_id
      JOIN invoices inv ON ii.invoice_id = inv.id
      WHERE inv.status IN ('PAID', 'PARTIAL')
      GROUP BY i.metal_type, i.purity
      ORDER BY value DESC
    `, { type: sequelize.QueryTypes.SELECT });

    res.json({ success: true, data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// ================= TOP PRODUCTS =================
export const getTopProducts = async (req, res) => {
  try {
    const data = await sequelize.query(`
      SELECT 
        i.item_name,
        i.category,
        COUNT(ii.id) as units_sold,
        COALESCE(SUM(ii.total_amount), 0) as total_revenue
      FROM invoice_items ii
      JOIN items i 
        ON i.id = ii.item_id
      JOIN invoices inv 
        ON ii.invoice_id = inv.id
      WHERE inv.status IN ('PAID', 'PARTIAL')
      GROUP BY i.id, i.item_name, i.category
      ORDER BY total_revenue DESC
      LIMIT 5
    `, { type: sequelize.QueryTypes.SELECT });

    // 🔥 Max revenue (performance calculate karne ke liye)
    const maxRevenue = data.length > 0 ? Number(data[0].total_revenue) : 0;

    // 🔥 Final UI format
    const finalData = data.map((item, index) => ({
      rank: index + 1,
      product_name: item.item_name,
      category: item.category,
      units_sold: Number(item.units_sold),
      total_revenue: Number(item.total_revenue),
      performance: maxRevenue
        ? Math.round((item.total_revenue / maxRevenue) * 100)
        : 0,
    }));

    res.json({
      success: true,
      data: finalData,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
export const getAllReports = async (req, res) => {
  try {
    // 🔹 1. Dashboard Summary
    const totalCustomers = await Customer.count();
    const totalRevenue = await Invoice.sum("total_amount") || 0;
    const totalSales = await Invoice.count();

    const dashboardSummary = {
      totalCustomers,
      totalRevenue,
      totalSales,
    };

    // 🔹 2. Cash vs Account
    const cashVsAccount = await sequelize.query(`
      SELECT 
        DATE(p.payment_date) as date,
        TO_CHAR(p.payment_date, 'Dy') as day,
        SUM(CASE WHEN p.payment_method = 'CASH' THEN p.amount ELSE 0 END) as cash,
        SUM(CASE WHEN p.payment_method != 'CASH' THEN p.amount ELSE 0 END) as online,
        SUM(p.amount) as total
      FROM payments p
      GROUP BY DATE(p.payment_date), TO_CHAR(p.payment_date, 'Dy')
      ORDER BY DATE(p.payment_date) ASC
    `, { type: sequelize.QueryTypes.SELECT });

    // 🔹 3. Category Sales
    const categoryRaw = await sequelize.query(`
      SELECT 
        i.category,
        SUM(ii.total_amount) as total_revenue
      FROM invoice_items ii
      JOIN items i ON i.id = ii.item_id
      JOIN invoices inv ON ii.invoice_id = inv.id
      WHERE inv.status IN ('PAID', 'PARTIAL')
      GROUP BY i.category
    `, { type: sequelize.QueryTypes.SELECT });

    const totalCategoryRevenue = categoryRaw.reduce(
      (sum, item) => sum + Number(item.total_revenue),
      0
    );

    const categorySales = categoryRaw.map(item => ({
      category: item.category,
      percentage: totalCategoryRevenue
        ? Number(((item.total_revenue / totalCategoryRevenue) * 100).toFixed(0))
        : 0,
    }));

    // 🔹 4. Type Distribution
    const typeDistribution = await sequelize.query(`
      SELECT 
        CONCAT(i.metal_type, ' ', i.purity) as label,
        SUM(ii.total_amount) as value
      FROM invoice_items ii
      JOIN items i ON i.id = ii.item_id
      JOIN invoices inv ON ii.invoice_id = inv.id
      WHERE inv.status IN ('PAID', 'PARTIAL')
      GROUP BY i.metal_type, i.purity
      ORDER BY value DESC
    `, { type: sequelize.QueryTypes.SELECT });

    // 🔹 5. Top Products
    const topProductsRaw = await sequelize.query(`
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
      ORDER BY total_revenue DESC
      LIMIT 5
    `, { type: sequelize.QueryTypes.SELECT });

    const maxRevenue = topProductsRaw.length > 0 ? Number(topProductsRaw[0].total_revenue) : 0;

    const topProducts = topProductsRaw.map((item, index) => ({
      rank: index + 1,
      product_name: item.item_name,
      category: item.category,
      units_sold: Number(item.units_sold),
      total_revenue: Number(item.total_revenue),
      performance: maxRevenue
        ? Math.round((item.total_revenue / maxRevenue) * 100)
        : 0,
    }));

    // 🔥 FINAL RESPONSE (sab ek sath)
    res.json({
      success: true,
      data: {
        dashboardSummary,
        cashVsAccount,
        categorySales,
        typeDistribution,
        topProducts,
      },
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
export const getAllReportsFiltered = async (req, res) => {
  try {
    const { level, store_id, district_id } = req.query;

    // 🔥 Dynamic Filter
    let filter = "";

    if (level === "store" && store_id) {
      filter = `AND inv.organization_id = ${store_id}`;
    }

    if (level === "district" && district_id) {
      filter = `AND inv.organization_id IN (
        SELECT id FROM stores WHERE district_id = ${district_id}
      )`;
    }

    // ================= DASHBOARD SUMMARY =================
    const totalCustomers = await Customer.count();

    const totalRevenue = await sequelize.query(`
      SELECT COALESCE(SUM(inv.total_amount),0) as total
      FROM invoices inv
      WHERE inv.status IN ('PAID','PARTIAL')
      ${filter}
    `, { type: sequelize.QueryTypes.SELECT });

    const totalSales = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM invoices inv
      WHERE inv.status IN ('PAID','PARTIAL')
      ${filter}
    `, { type: sequelize.QueryTypes.SELECT });

    const dashboardSummary = {
      totalCustomers,
      totalRevenue: Number(totalRevenue[0].total),
      totalSales: Number(totalSales[0].count),
    };

    // ================= CASH vs ACCOUNT =================
    const cashVsAccount = await sequelize.query(`
      SELECT 
        DATE(p.payment_date) as date,
        TO_CHAR(p.payment_date, 'Dy') as day,
        SUM(CASE WHEN p.payment_method = 'CASH' THEN p.amount ELSE 0 END) as cash,
        SUM(CASE WHEN p.payment_method != 'CASH' THEN p.amount ELSE 0 END) as online,
        SUM(p.amount) as total
      FROM payments p
      JOIN invoices inv ON p.invoice_id = inv.id
      WHERE inv.status IN ('PAID','PARTIAL')
      ${filter}
      GROUP BY DATE(p.payment_date), TO_CHAR(p.payment_date, 'Dy')
      ORDER BY DATE(p.payment_date) ASC
    `, { type: sequelize.QueryTypes.SELECT });

    // ================= CATEGORY SALES =================
    const categoryRaw = await sequelize.query(`
      SELECT 
        i.category,
        SUM(ii.total_amount) as total_revenue
      FROM invoice_items ii
      JOIN items i ON i.id = ii.item_id
      JOIN invoices inv ON ii.invoice_id = inv.id
      WHERE inv.status IN ('PAID','PARTIAL')
      ${filter}
      GROUP BY i.category
    `, { type: sequelize.QueryTypes.SELECT });

    const totalCategoryRevenue = categoryRaw.reduce(
      (sum, item) => sum + Number(item.total_revenue),
      0
    );

    const categorySales = categoryRaw.map(item => ({
      category: item.category,
      percentage: totalCategoryRevenue
        ? Math.round((item.total_revenue / totalCategoryRevenue) * 100)
        : 0,
    }));

    // ================= TYPE DISTRIBUTION =================
    const typeDistribution = await sequelize.query(`
      SELECT 
        CONCAT(i.metal_type, ' ', i.purity) as label,
        SUM(ii.total_amount) as value
      FROM invoice_items ii
      JOIN items i ON i.id = ii.item_id
      JOIN invoices inv ON ii.invoice_id = inv.id
      WHERE inv.status IN ('PAID','PARTIAL')
      ${filter}
      GROUP BY i.metal_type, i.purity
      ORDER BY value DESC
    `, { type: sequelize.QueryTypes.SELECT });

    // ================= TOP PRODUCTS =================
    const topProductsRaw = await sequelize.query(`
      SELECT 
        i.item_name,
        i.category,
        COUNT(ii.id) as units_sold,
        COALESCE(SUM(ii.total_amount), 0) as total_revenue
      FROM invoice_items ii
      JOIN items i ON i.id = ii.item_id
      JOIN invoices inv ON ii.invoice_id = inv.id
      WHERE inv.status IN ('PAID','PARTIAL')
      ${filter}
      GROUP BY i.id, i.item_name, i.category
      ORDER BY total_revenue DESC
      LIMIT 5
    `, { type: sequelize.QueryTypes.SELECT });

    const maxRevenue = topProductsRaw.length > 0
      ? Number(topProductsRaw[0].total_revenue)
      : 0;

    const topProducts = topProductsRaw.map((item, index) => ({
      rank: index + 1,
      product_name: item.item_name,
      category: item.category,
      units_sold: Number(item.units_sold),
      total_revenue: Number(item.total_revenue),
      performance: maxRevenue
        ? Math.round((item.total_revenue / maxRevenue) * 100)
        : 0,
    }));

    // ================= FINAL RESPONSE =================
    res.json({
      success: true,
      data: {
        dashboardSummary,
        cashVsAccount,
        categorySales,
        typeDistribution,
        topProducts,
      },
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};