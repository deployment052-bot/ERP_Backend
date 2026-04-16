import express from "express";
import {
  getDistrictStoreManagement,
  getDistrictStoreInventory,
} from "../controller/districtController.js";

import {auth} from "../middlewares/authMiddleware.js";


const router = express.Router();



router.get(
  "/district/store-management",
  auth,
  getDistrictStoreManagement
);

router.get(
  "/district/store-management/:storeId",
  auth,
  getDistrictStoreInventory
);

export default router;