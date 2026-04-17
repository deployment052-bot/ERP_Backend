import express from "express";
import {auth} from "../middlewares/authMiddleware.js"
// Import all your screenshot controllers
import {
  createCustomer,
  searchCustomers,
  getCustomer,
} from "../controller/customerController.js";

// import {
//   createInvoice,
//   getInvoiceDetail,
//   getCustomerInvoices,
//   getPendingInvoices,
// } from "../controllers/invoiceController.js";

// import {
//   createPayment,
//   getPaymentsByInvoice,
// } from "../controllers/paymentController.js";

import {
  getLedger,
  getCustomerLedgerDetail,
} from "../controller/ledgerController.js";

const router = express.Router();

// ==================== CUSTOMER ROUTES ====================
router.post("/customer", createCustomer);
router.get("/customer/search", searchCustomers);
router.get("/customer/:id", getCustomer);

// ==================== INVOICE ROUTES ====================
// router.post("/invoice", createInvoice);
// router.get("/invoice/detail/:invoice_id", getInvoiceDetail);
// router.get("/invoice/customer/:customer_id", getCustomerInvoices);
// router.get("/invoice/pending", getPendingInvoices);

// ==================== PAYMENT ROUTES ====================
// router.post("/payment", createPayment);
// router.get("/payment/invoice/:invoice_id", getPaymentsByInvoice);

// ==================== LEDGER ROUTES ====================
router.get("/ledger", auth,getLedger);
router.get("/ledger/customer/:customer_id",auth, getCustomerLedgerDetail);

export default router;