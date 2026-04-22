import express from "express";
import {
  getReceivedRequestsHO,
  getRequestDetailsHO,
  approveAndDispatchHO,
  rejectRequestHO
} from "../controllers/headOfficeStockController.js";

const router = express.Router();

// Head Office Routes
router.get("/requests", getReceivedRequestsHO);
router.get("/request/:id", getRequestDetailsHO);
router.post("/request/:id/approve-dispatch", approveAndDispatchHO);
router.post("/request/:id/reject", rejectRequestHO);

export default router;