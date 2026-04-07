import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const StockRequestItem = sequelize.define(
  "StockRequestItem",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    request_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },

    item_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },

    qty: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
    },

    weight: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
      defaultValue: 0,
    },

    rate: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },

    approved_qty: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
    },

    approved_weight: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: false,
      defaultValue: 0,
    },

    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "stock_request_items",
    timestamps: false,
    indexes: [
      { fields: ["request_id"] },
      { fields: ["item_id"] },
    ],
  }
);

export default StockRequestItem;