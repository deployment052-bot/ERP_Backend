import sequelize from "../config/db.js";

import Item from "./Item.js";
import Stock from "./Stock.js";
import StockTransfer from "./stockTransfer.js";
import StockTransferItem from "./stockTransferItem.js";
import StockMovement from ".//stockmovement.js";
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

// ================= STORE / ORGANIZATION =================
// organization_id = Store.id

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

// ================= TRANSFER =================
StockTransfer.hasMany(StockTransferItem, {
  foreignKey: "transfer_id",
  as: "items",
});

StockTransferItem.belongsTo(StockTransfer, {
  foreignKey: "transfer_id",
  as: "transfer",
});

export {
  sequelize,
  Item,
  Stock,
  StockTransfer,
  StockTransferItem,
  StockMovement,
  AuditTrail,
  Store,
};