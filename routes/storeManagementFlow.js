import express from "express";
import {
  getDistricts,
  getDistrictInventory,
  getRetailStores,
  getStoreInventory
} from "../controllers/storeManagementFlowController.js";

const router = express.Router();

router.get("/districts", getDistricts);

router.get("/district/:district_id/inventory", getDistrictInventory);

router.get("/district/:district_id/stores", getRetailStores);

router.get("/store/:store_id/inventory", getStoreInventory);

export default router;