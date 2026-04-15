import express from "express";
import { getDashboardAdvanced,getDashboardCards,getSalesPurchaseTrend,getProfitLoss,getRevenueTrend,getRecentActivities } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/dashboard", getDashboardAdvanced);
router.get("/dashboard/cards", getDashboardCards);
router.get("/sales-purchase-trend", getSalesPurchaseTrend);
router.get("/profit-loss", getProfitLoss);
router.get("/revenue-trend", getRevenueTrend);
router.get("/recent-activities", getRecentActivities);
export default router;