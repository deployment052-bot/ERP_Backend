import express from "express";
import {
  addItem,
  getItems,
  getItemsByLevel,
  getChildItems,
} from "../controllers/itemController.js";

import { fakeAuth } from "../middlewares/authMiddleware.js"; // ✅ import

const router = express.Router();

// ✅ ADD ITEM
router.post("/add", fakeAuth, addItem);

// ✅ GET OWN ITEMS
router.get("/", fakeAuth, getItems);

// ✅ GET BY LEVEL
router.get("/level/:level", fakeAuth, getItemsByLevel);

// ✅ GET CHILD ITEMS
router.get("/child", fakeAuth, getChildItems);

export default router;