import express from "express";
import {
  addItem,
  getItems,
  getItemsByLevel,
  getChildItems,
} from "../controllers/itemController.js";



const router = express.Router();

/**
 * @route POST /api/items/add
 * @desc Add a new item
 * @access Private
 */
router.post("/add", fakeAuth, addItem);

/**
 * @route GET /api/items
 * @desc Get own items
 * @access Private
 */
router.get("/", fakeAuth, getItems);

/**
 * @route GET /api/items/level/:level
 * @desc Get items by level
 * @access Private
 */
router.get("/level/:level", fakeAuth, getItemsByLevel);

/**
 * @route GET /api/items/child
 * @desc Get child items
 * @access Private
 */
router.get("/child", fakeAuth, getChildItems);

export default router;