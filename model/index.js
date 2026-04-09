import sequelize from "../config/db.js";

import Item from "./item.js";
import Stock from "./stockrecord.js";
import StockTransfer from "./stockTransfer.js";
import StockTransferItem from "./stockTransferItem.js";
import StockMovement from "./stockmovement.js";
import StockRequest from "./StockRequest.js";
import StockRequestItem from "./stockRequestItem.js";
import AuditTrail from "./audittrail.js";
import Store from "./Store.js";

/* =========================================================
   ITEM RELATIONS
========================================================= */

// Item -> Stock
Item.hasMany(Stock, {
  foreignKey: "item_id",
  as: "stocks",
});

Stock.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});

// Item -> Stock Movement
Item.hasMany(StockMovement, {
  foreignKey: "item_id",
  as: "movements",
});

StockMovement.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});

// Item -> Stock Transfer Items
Item.hasMany(StockTransferItem, {
  foreignKey: "item_id",
  as: "transfer_items",
});

StockTransferItem.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});

// Item -> Stock Request Items
Item.hasMany(StockRequestItem, {
  foreignKey: "item_id",
  as: "request_items",
});

StockRequestItem.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});

/* =========================================================
   STORE / ORGANIZATION RELATIONS
========================================================= */

// Store -> Item
Store.hasMany(Item, {
  foreignKey: "organization_id",
  as: "items",
});

Item.belongsTo(Store, {
  foreignKey: "organization_id",
  as: "organization",
});

// Store -> Stock
Store.hasMany(Stock, {
  foreignKey: "organization_id",
  as: "stocks",
});

Stock.belongsTo(Store, {
  foreignKey: "organization_id",
  as: "organization",
});

// Store -> Stock Movement
Store.hasMany(StockMovement, {
  foreignKey: "organization_id",
  as: "stock_movements",
});

StockMovement.belongsTo(Store, {
  foreignKey: "organization_id",
  as: "organization",
});

/* =========================================================
   STOCK REQUEST RELATIONS
========================================================= */

// Store -> Outgoing Requests
Store.hasMany(StockRequest, {
  foreignKey: "from_organization_id",
  as: "outgoing_requests",
});

// Store -> Incoming Requests
Store.hasMany(StockRequest, {
  foreignKey: "to_organization_id",
  as: "incoming_requests",
});

// Request -> From Store
StockRequest.belongsTo(Store, {
  foreignKey: "from_organization_id",
  as: "fromOrganization",
});

// Request -> To Store
StockRequest.belongsTo(Store, {
  foreignKey: "to_organization_id",
  as: "toOrganization",
});

// Request -> Request Items
StockRequest.hasMany(StockRequestItem, {
  foreignKey: "request_id",
  as: "request_items",
});

StockRequestItem.belongsTo(StockRequest, {
  foreignKey: "request_id",
  as: "request",
});

/* =========================================================
   STOCK TRANSFER RELATIONS
========================================================= */

// Store -> Outgoing Transfers
Store.hasMany(StockTransfer, {
  foreignKey: "from_organization_id",
  as: "outgoing_transfers",
});

// Store -> Incoming Transfers
Store.hasMany(StockTransfer, {
  foreignKey: "to_organization_id",
  as: "incoming_transfers",
});

// Transfer -> From Store
StockTransfer.belongsTo(Store, {
  foreignKey: "from_organization_id",
  as: "fromOrganization",
});

// Transfer -> To Store
StockTransfer.belongsTo(Store, {
  foreignKey: "to_organization_id",
  as: "toOrganization",
});

// Transfer -> Transfer Items
StockTransfer.hasMany(StockTransferItem, {
  foreignKey: "transfer_id",
  as: "transfer_items",
});

StockTransferItem.belongsTo(StockTransfer, {
  foreignKey: "transfer_id",
  as: "transfer",
});

/* =========================================================
   REQUEST <-> TRANSFER LINK
========================================================= */

// One request can generate one transfer
StockRequest.hasOne(StockTransfer, {
  foreignKey: "request_id",
  as: "transfer",
});

StockTransfer.belongsTo(StockRequest, {
  foreignKey: "request_id",
  as: "request",
});

/* =========================================================
   AUDIT TRAIL RELATIONS (recommended)
========================================================= */

// Store -> AuditTrail
Store.hasMany(AuditTrail, {
  foreignKey: "organization_id",
  as: "audit_trails",
});

AuditTrail.belongsTo(Store, {
  foreignKey: "organization_id",
  as: "organization",
});

// Item -> AuditTrail
Item.hasMany(AuditTrail, {
  foreignKey: "item_id",
  as: "audit_trails",
});

AuditTrail.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});

/* =========================================================
   EXPORTS
========================================================= */

export {
  sequelize,
  Item,
  Stock,
  StockTransfer,
  StockTransferItem,
  StockMovement,
  StockRequest,
  StockRequestItem,
  AuditTrail,
  Store,
};