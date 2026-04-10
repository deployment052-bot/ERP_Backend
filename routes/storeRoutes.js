import express from "express";
import {
  registerStore,
  bulkCreateStores,
  getStoresByDistrict,
} from "../controllers/storeController.js";

import { checkRole } from "../middlewares/auth.js";

const router = express.Router();

//  Only SuperAdmin
router.post("/register", checkRole("SuperAdmin"), registerStore);

router.post("/bulk", checkRole("SuperAdmin"), bulkCreateStores);
router.get("/district/:district_id", getStoresByDistrict);

export default router;