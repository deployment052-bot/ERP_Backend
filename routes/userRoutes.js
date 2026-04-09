import express from "express";
import { createUsersForStore,bulkCreateUsers } from "../controllers/userController.js";

const router = express.Router();

router.post("/create-users", createUsersForStore);
router.post("/bulk", bulkCreateUsers);
export default router;