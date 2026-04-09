import express from "express";
import {
  registerStore,
  bulkCreateStores,
} from "../controllers/storeController.js";

const router = express.Router();

// Single Store Register
router.post("/register", registerStore);

// Bulk Insert (20 stores ek saath)
router.post("/bulk", bulkCreateStores);

export default router;