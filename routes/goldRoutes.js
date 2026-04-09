import express from "express";
import { fetchGoldRate } from "../controllers/goldController.js";

const router = express.Router();

router.get("/gold-rate", fetchGoldRate);

export default router;