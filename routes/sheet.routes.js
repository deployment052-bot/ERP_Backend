import express from "express";
import { getSheetDataController } from "../controllers/sheet.controller.js";

const router = express.Router();

router.get("/sheet-data", getSheetDataController);

export default router;