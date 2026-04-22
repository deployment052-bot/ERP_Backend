import express from "express";
import {
  getStaffStats,
  getAllStaff,
  getStaffById,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  toggleEmployeeStatus,
    exportStaffExcel
} from "../controllers/staffController.js";

const router = express.Router();

router.get("/stats", getStaffStats);
router.get("/", getAllStaff);
router.get("/:id", getStaffById);
router.post("/add", addEmployee);
router.put("/:id", updateEmployee);
router.delete("/:id", deleteEmployee);
router.patch("/:id/status", toggleEmployeeStatus);

router.get("/staff/export", exportStaffExcel);

export default router;
