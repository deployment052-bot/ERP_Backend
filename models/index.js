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



// STATE → DISTRICT
State.hasMany(District, { foreignKey: "state_id" });
District.belongsTo(State, { foreignKey: "state_id" });

// DISTRICT → STORE
District.hasMany(Store, { foreignKey: "district_id" });
Store.belongsTo(District, { foreignKey: "district_id" });

// STORE → ITEM
Store.hasMany(Item, { foreignKey: "store_id" });
Item.belongsTo(Store, { foreignKey: "store_id" });

// ITEM → STOCK
Item.hasOne(Stock, { foreignKey: "item_id" });
Stock.belongsTo(Item, { foreignKey: "item_id" });

// ================== CUSTOMER FLOW ==================

// CUSTOMER → INVOICE
Customer.hasMany(Invoice, { foreignKey: "customer_id" });
Invoice.belongsTo(Customer, { foreignKey: "customer_id" });

// INVOICE → PAYMENT
Invoice.hasMany(Payment, { foreignKey: "invoice_id" });
Payment.belongsTo(Invoice, { foreignKey: "invoice_id" });



// INVOICE → ITEMS (FIXED)
Invoice.hasMany(InvoiceItem, {
  foreignKey: "invoice_id",
  as: "items", 
});

InvoiceItem.belongsTo(Invoice, {
  foreignKey: "invoice_id",
});

// ================== ACCOUNTING ==================

// TRANSACTION → ENTRIES
Transaction.hasMany(TransactionEntry, {
  foreignKey: "transaction_id",
});
TransactionEntry.belongsTo(Transaction, {
  foreignKey: "transaction_id",
});


// CUSTOMER → LEDGER
Customer.hasMany(LedgerEntry, {
  foreignKey: "customer_id",
});

LedgerEntry.belongsTo(Customer, {
  foreignKey: "customer_id",
});

/**
 * NOTE: For simplicity, we are not creating associations for reference_type and reference_id in LedgerEntry.
 */

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
};