import express from "express";
import {
  getTransitDashboard,
  getActiveShipments,
  getShipmentDetails,
  markDelivered,
  sendLocation,
  getTrackingHistory,
  getRoute,
} from "../controllers/transitController.js";

const router = express.Router();
router.get("/dashboard", getTransitDashboard);
router.get("/shipments/active", getActiveShipments);
router.get("/shipments/:id", getShipmentDetails);
router.put("/shipments/:id/deliver", markDelivered);
router.post("/tracking/location", sendLocation);
router.get("/tracking/:id", getTrackingHistory);
router.get("/route", getRoute);

export default router;