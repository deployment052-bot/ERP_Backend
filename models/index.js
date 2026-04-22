// models/index.js

import sequelize from "../config/db.js";

// 🔥 IMPORTS (MATCH FILE NAMES EXACTLY)
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
import Bill from "./Bill.js";
import BillItem from "./BillItem.js";
import Driver from "./Driver.js";
import StockRequest from "./StockRequest.js";
import StockRequestItem from "./stockRequestItem.js";  
import StockTransfer from "./stockTransfer.js";
import StockTransferItem from "./stockTransferItem.js";
import TrackingLog from "./TrackingLog.js";
import StockMovement from "./stockMovement.js";



// ================== LOCATION ==================

State.hasMany(District, { foreignKey: "state_name" });
District.belongsTo(State, { foreignKey: "state_name" });

District.hasMany(Store, { foreignKey: "district_id" });
Store.belongsTo(District, { foreignKey: "district_id" });

Store.hasMany(Item, { foreignKey: "store_id" });
Item.belongsTo(Store, { foreignKey: "store_id" });

Item.hasOne(Stock, { foreignKey: "item_id" });
Stock.belongsTo(Item, { foreignKey: "item_id" });


// ================== CUSTOMER ==================

Store.hasMany(Customer, {
  foreignKey: "store_code",
  sourceKey: "store_code",
});
Customer.belongsTo(Store, {
  foreignKey: "store_code",
  targetKey: "store_code",
});

Customer.hasMany(Invoice, {
  foreignKey: "customer_id",
  as: "invoices",
});

Invoice.belongsTo(Customer, {
  foreignKey: "customer_id",
  as: "customer",
});


// ================== INVOICE ==================

Invoice.hasMany(InvoiceItem, {
  foreignKey: "invoice_id",
  as: "items",
});

InvoiceItem.belongsTo(Invoice, {
  foreignKey: "invoice_id",
});

Invoice.hasMany(Payment, {
  foreignKey: "invoice_id",
  as: "payments",
});

Payment.belongsTo(Invoice, {
  foreignKey: "invoice_id",
});


// ================== BILL ==================

Bill.hasMany(BillItem, {
  foreignKey: "bill_id",
  as: "bill_items",
});

BillItem.belongsTo(Bill, {
  foreignKey: "bill_id",
});


// ================== LEDGER ==================

Customer.hasMany(LedgerEntry, {
  foreignKey: "customer_id",
  as: "ledger_entries",
});

LedgerEntry.belongsTo(Customer, {
  foreignKey: "customer_id",
});


// ================== STOCK REQUEST FLOW ==================

StockRequest.hasMany(StockRequestItem, {
  foreignKey: "request_id",
  as: "request_items",
});

StockRequestItem.belongsTo(StockRequest, {
  foreignKey: "request_id",
});

//  ONLY ONE ASSOCIATION (correct)
StockRequestItem.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});

// ================== TRANSFER ==================

//  Request → Transfer
StockRequest.hasOne(StockTransfer, {
  foreignKey: "request_id",
  as: "transfer",
});

//  Transfer → Request (IMPORTANT FIX)
StockTransfer.belongsTo(StockRequest, {
  foreignKey: "request_id",
  as: "request", 
});


// Transfer → Items
StockTransfer.hasMany(StockTransferItem, {
  foreignKey: "transfer_id",
  as: "items",
});

StockTransferItem.belongsTo(StockTransfer, {
  foreignKey: "transfer_id",
});


//  TransferItem → Item
StockTransferItem.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});
StockTransfer.belongsTo(Driver, {
  foreignKey: "driver_id",
  as: "driver",
});
StockTransfer.hasMany(TrackingLog, {
  foreignKey: "transfer_id",
  as: "tracking",
});

// ================== EXPORT ==================

export {
  sequelize,
  State,
  District,
  Store,
  Item,
  Stock,
  Customer,
  Invoice,
  Payment,
  InvoiceItem,
  Transaction,
  TransactionEntry,
  LedgerEntry,
  Bill,
  BillItem,
  StockRequest,
  StockRequestItem,
  StockTransfer,
  StockTransferItem,
  Driver,
  TrackingLog,
  StockMovement,
};  