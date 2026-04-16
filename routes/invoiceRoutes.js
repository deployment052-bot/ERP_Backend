import express from "express";
import { createInvoice } from "../controllers/createInvoiceController.js";
import  downloadInvoiceByCustomer  from "../controllers/invoicePDFController.js";
const router = express.Router();

router.post("/create", createInvoice);
router.get("/invoice/:customer_id/pdf", downloadInvoiceByCustomer);

export default router;