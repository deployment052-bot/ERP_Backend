import express from "express";
import {
  getStates,
  getDistrictsByState,
  getStoresByDistrict,
  getStocksByStore,
   getFullHierarchy,
} from "../controllers/hierarchyController.js";

const router = express.Router();

/**
 * @route GET /api/hierarchy/states
 * @desc Get all states
 * @access Private
 */
router.get("/states", getStates);

/**
 * @route GET /api/hierarchy/districts/:stateId
 * @desc Get districts by state
 * @access Private
 */
router.get("/districts/:stateId", getDistrictsByState);

/**
 * @route GET /api/hierarchy/stores/:districtId
 * @desc Get stores by district
 * @access Private
 */
router.get("/stores/:districtId", getStoresByDistrict);

/**
 * @route GET /api/hierarchy/stocks/:storeId
 * @desc Get stocks by store
 * @access Private
 */
router.get("/stocks/:storeId", getStocksByStore);
/**
 * @route GET /api/hierarchy/full
 * @desc Get full hierarchy (states, districts, stores, stocks)
 * @access Private
 */
router.get("/full", getFullHierarchy);

export default router;