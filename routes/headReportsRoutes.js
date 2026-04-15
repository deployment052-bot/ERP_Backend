import express from "express";
import { getDashboardAnalytics,getMonthlySalesProfit, getCategoryWiseSales,getMetalDistribution,getTopProducts, getDailySalesTrend} from "../controllers/headReportsController.js";
const router = express.Router();

/**
 * @route   GET /api/dashboard
 * @desc    Get Dashboard Analytics (Revenue, Profit, Inventory, Avg Sales)
 * @access  Public (for now) | Later: Protected (JWT + RBAC)
 */
router.get("/", getDashboardAnalytics);
router.get("/monthly-trend", getMonthlySalesProfit);
router.get("/category-wise-sales", getCategoryWiseSales);
router.get("/metal-distribution", getMetalDistribution);
router.get("/top-products", getTopProducts);
router.get("/daily-trend", getDailySalesTrend);
export default router;