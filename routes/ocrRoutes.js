import express from "express";
import { upload } from "../middlewares/upload.js";
import { uploadAndProcessPDF } from "../controllers/ocrController.js";

const router = express.Router();

router.post("/upload-pdf", upload.single("file"), uploadAndProcessPDF);

export default router;