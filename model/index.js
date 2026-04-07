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

// ================= ITEM =================
Item.hasMany(Stock, {
  foreignKey: "item_id",
  as: "stocks",
});

Stock.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});

Item.hasMany(StockMovement, {
  foreignKey: "item_id",
  as: "movements",
});

StockMovement.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});

Item.hasMany(StockTransferItem, {
  foreignKey: "item_id",
  as: "transfer_items",
});

StockTransferItem.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});

// ⚠️ FIX: alias conflict removed
Item.hasMany(StockRequestItem, {
  foreignKey: "item_id",
  as: "item_request_items",
});

StockRequestItem.belongsTo(Item, {
  foreignKey: "item_id",
  as: "item",
});

// ================= STORE =================
Store.hasMany(Stock, {
  foreignKey: "organization_id",
  as: "stocks",
});

Stock.belongsTo(Store, {
  foreignKey: "organization_id",
  as: "organization",
});

Store.hasMany(Item, {
  foreignKey: "organization_id",
  as: "items",
});

Item.belongsTo(Store, {
  foreignKey: "organization_id",
  as: "organization",
});

Store.hasMany(StockMovement, {
  foreignKey: "organization_id",
  as: "stock_movements",
});

StockMovement.belongsTo(Store, {
  foreignKey: "organization_id",
  as: "organization",
});

// ================= STOCK REQUEST =================
Store.hasMany(StockRequest, {
  foreignKey: "from_organization_id",
  as: "outgoing_requests",
});

Store.hasMany(StockRequest, {
  foreignKey: "to_organization_id",
  as: "incoming_requests",
});

StockRequest.belongsTo(Store, {
  foreignKey: "from_organization_id",
  as: "fromOrganization",
});

StockRequest.belongsTo(Store, {
  foreignKey: "to_organization_id",
  as: "toOrganization",
});

// 🔥 MAIN FIX (important)
StockRequest.hasMany(StockRequestItem, {
  foreignKey: "request_id",
  as: "request_items",
});

StockRequestItem.belongsTo(StockRequest, {
  foreignKey: "request_id",
  as: "request",
});

// ================= TRANSFER =================
Store.hasMany(StockTransfer, {
  foreignKey: "from_organization_id",
  as: "outgoing_transfers",
});

Store.hasMany(StockTransfer, {
  foreignKey: "to_organization_id",
  as: "incoming_transfers",
});

StockTransfer.belongsTo(Store, {
  foreignKey: "from_organization_id",
  as: "fromOrganization",
});

StockTransfer.belongsTo(Store, {
  foreignKey: "to_organization_id",
  as: "toOrganization",
});

StockTransfer.hasMany(StockTransferItem, {
  foreignKey: "transfer_id",
  as: "items",
});

StockTransferItem.belongsTo(StockTransfer, {
  foreignKey: "transfer_id",
  as: "transfer",
});

// ================= REQUEST <-> TRANSFER =================
StockRequest.hasOne(StockTransfer, {
  foreignKey: "request_id",
  as: "transfer",
});

StockTransfer.belongsTo(StockRequest, {
  foreignKey: "request_id",
  as: "request",
});

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