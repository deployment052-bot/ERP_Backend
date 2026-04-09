import express from "express";
import { createBilling } from "../controllers/billingController.js";

const router = express.Router();

router.post("/create", createBilling);

export default router;