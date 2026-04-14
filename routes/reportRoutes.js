import express from "express";
import {
  getDashboardSummary,
  getCashVsAccount,
  getCategorySales,
  getTypeDistribution,
  getTopProducts,
  getAllReports,
  getAllReportsFiltered,
} from "../controllers/reportController.js";

const router = express.Router();

router.get("/summary", getDashboardSummary);
router.get("/cash-vs-account", getCashVsAccount);
router.get("/category-sales", getCategorySales);
router.get("/type-distribution", getTypeDistribution);
router.get("/top-products", getTopProducts);
router.get("/reports/all", getAllReports);
router.get("/reports/filtered", getAllReportsFiltered);

export default router;