import express from "express";
import {
  getStockList,
  getSingleStock,
  updateStockStatus,
  stockSummary,
  addStockIn,
  getStockItemsByCategory
} from "../controller/stock.controller.js";
import { auth } from "../middlewares/authMiddleware.js"

const router = express.Router();

router.get("/list", auth, getStockList);
router.get("/summary", auth, stockSummary);
router.get("/:id", auth, getSingleStock);
router.put("/:id/status", auth, updateStockStatus);
router.post("/stock-in", auth, addStockIn);
router.get("/category/:category", auth, getStockItemsByCategory);
export default router;