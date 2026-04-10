import express from "express";
import { createDistrict,getDistrictByState} from "../controllers/District.js";
import { checkRole } from "../middlewares/auth.js";

const router = express.Router();

// Only SuperAdmin can create District
router.post("/create", checkRole("SuperAdmin"), createDistrict);
router.get("/state/:state_name", getDistrictByState);

export default router;