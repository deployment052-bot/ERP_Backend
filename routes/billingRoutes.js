import express from "express";
import { createBill } from "../controllers/billingController.js";

const router = express.Router();
router.post("/create-bill", createBill);

export default router;