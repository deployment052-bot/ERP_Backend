import express from "express";
import {
  getAllStoresLedger,
  getStoreCustomerLedger,
  getCustomerInvoices,
  getInvoicePayments,
  getDashboardCards,
    exportLedgerExcel
} from "../controllers/headLedgerController.js";

const router = express.Router();

// 🔹 Ledger Main (All Stores)
router.get("/stores", getAllStoresLedger);

// 🔹 Store → Customers
router.get("/store/:store_code/customers", getStoreCustomerLedger);

// 🔹 Customer → Invoices
router.get("/customer/:customer_id/invoices", getCustomerInvoices);

// 🔹 Invoice → Payment History
router.get("/invoice/:invoice_id/payments", getInvoicePayments);
router.get("/ledger/:store_code", exportLedgerExcel);


router.get("/cards", getDashboardCards);
router.get("/ledger/:store_code", exportLedgerExcel);
export default router;