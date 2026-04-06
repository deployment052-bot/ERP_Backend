import express from "express";
import { getDashboardSummary } from "../controller/dashboardController.js";
import { auth } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/summary", auth, getDashboardSummary);

export default router;