import express from "express";
const router = express.Router();

import { createCustomer } from "../controllers/customerController.js";
import {
  createInvoice,
  getCustomerInvoices,
  getInvoiceDetail,
} from "../controllers/invoiceController.js";
import {
  createPayment,
  getPayments,
} from "../controllers/paymentController.js";
import { getLedger } from "../controllers/ledgerController.js";

/**
 * @route POST /api/customer
 * @desc Create a new customer
 * @access Public
 */
router.post("/customer", createCustomer);

/**
 * @route POST /api/invoice
 * @desc Create an invoice with items
 * @access Public
 */
router.post("/invoice", createInvoice);
/**
 * @route GET /api/invoice/:customer_id
 * @desc Get all invoices for a customer
 * @access Public
 */
router.get("/invoice/:customer_id", getCustomerInvoices);

/**
 * @route POST /api/payments
 * @desc Create a payment for an invoice
 * @access Public
 */
router.post("/payment", createPayment);
/**
 * @route GET /api/payments/:invoice_id
 * @desc Get all payments for an invoice
 * @access Public
 */
router.get("/payment/:invoice_id", getPayments); 
/**
 * @route GET /api/ledger
 * @desc Get ledger entries
 * @access Public
 */
router.get("/", getLedger);
/**
 * @route GET /api/invoice/detail/:invoice_id
 * @desc Get detailed invoice info (items + payments)
 * @access Public
 */
router.get("/invoice/detail/:invoice_id", getInvoiceDetail);
export default router;