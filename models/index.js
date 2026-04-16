import State from "./State.js";
import District from "./District.js";
import Store from "./Store.js";
import Item from "./Item.js";
import Stock from "./Stock.js";
import Customer from "./Customer.js";
import Invoice from "./Invoice.js";
import Payment from "./Payment.js";
import InvoiceItem from "./InvoiceItem.js";
import Transaction from "./Transaction.js";
import TransactionEntry from "./TransactionEntry.js";
import LedgerEntry from "./LedgerEntry.js";
import sequelize from "../config/db.js";
import Bill from "./Bill.js";
import BillItem from "./BillItem.js";

// ================== LOCATION HIERARCHY ==================

// STATE → DISTRICT
State.hasMany(District, { foreignKey: "state_name" });
District.belongsTo(State, { foreignKey: "state_name" });

// DISTRICT → STORE
District.hasMany(Store, { foreignKey: "district_id" });
Store.belongsTo(District, { foreignKey: "district_id" });

// STORE → ITEM
Store.hasMany(Item, { foreignKey: "store_id" });
Item.belongsTo(Store, { foreignKey: "store_id" });

// ITEM → STOCK
Item.hasOne(Stock, { foreignKey: "item_id" });
Stock.belongsTo(Item, { foreignKey: "item_id" });

// ================== STORE RELATIONS ==================

// STORE → CUSTOMER
Store.hasMany(Customer, {
  foreignKey: "store_code",
  sourceKey: "store_code",
});
Customer.belongsTo(Store, {
  foreignKey: "store_code",
  targetKey: "store_code",
});

// STORE → INVOICE
Store.hasMany(Invoice, {
  foreignKey: "store_code",
  sourceKey: "store_code",
});
Invoice.belongsTo(Store, {
  foreignKey: "store_code",
  targetKey: "store_code",
});

// STORE → PAYMENT
Store.hasMany(Payment, {
  foreignKey: "store_code",
  sourceKey: "store_code",
});
Payment.belongsTo(Store, {
  foreignKey: "store_code",
  targetKey: "store_code",
});

// ================== CUSTOMER FLOW ==================

// CUSTOMER → INVOICE
Customer.hasMany(Invoice, {
  foreignKey: "customer_id",
  as: "invoices",
});

Invoice.belongsTo(Customer, {
  foreignKey: "customer_id",
  as: "customer", // 🔥 IMPORTANT FIX
});

// ================== INVOICE FLOW ==================

// INVOICE → ITEMS
Invoice.hasMany(InvoiceItem, {
  foreignKey: "invoice_id",
  as: "items",
});

InvoiceItem.belongsTo(Invoice, {
  foreignKey: "invoice_id",
});

// INVOICE → PAYMENT
Invoice.hasMany(Payment, {
  foreignKey: "invoice_id",
  as: "payments",
});

Payment.belongsTo(Invoice, {
  foreignKey: "invoice_id",
});

// ================== BILLING ==================

Bill.hasMany(BillItem, {
  foreignKey: "bill_id",
  as: "bill_items",
});

BillItem.belongsTo(Bill, {
  foreignKey: "bill_id",
});

// ================== ACCOUNTING ==================

// TRANSACTION → ENTRIES
Transaction.hasMany(TransactionEntry, {
  foreignKey: "transaction_id",
  as: "entries",
});

TransactionEntry.belongsTo(Transaction, {
  foreignKey: "transaction_id",
});

// ================== LEDGER ==================

// CUSTOMER → LEDGER
Customer.hasMany(LedgerEntry, {
  foreignKey: "customer_id",
  as: "ledger_entries",
});

LedgerEntry.belongsTo(Customer, {
  foreignKey: "customer_id",
});

// LEDGER → INVOICE (Polymorphic)
LedgerEntry.belongsTo(Invoice, {
  foreignKey: "reference_id",
  constraints: false,
  as: "invoice",
});

// LEDGER → PAYMENT (Polymorphic)
LedgerEntry.belongsTo(Payment, {
  foreignKey: "reference_id",
  constraints: false,
  as: "payment",
});

// ================== EXPORT ==================

export {
  State,
  District,
  Store,
  Item,
  Stock,
  sequelize,
  Customer,
  Invoice,
  Payment,
  InvoiceItem,
  Transaction,
  TransactionEntry,
  LedgerEntry,
  Bill,
  BillItem,
};