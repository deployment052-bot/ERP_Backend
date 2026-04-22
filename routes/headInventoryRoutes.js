import express from "express";
import { getHeadOfficeStock } from "../controllers/headInventoryController.js";

const router = express.Router();

router.get("/stock", getHeadOfficeStock);

export default router;