import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Item = sequelize.define("Item", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  //  Identification
  article_code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },

  sku_code: {
    type: DataTypes.STRING,
    unique: true,
  },

  //  Basic Info
  item_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  metal_type: {
    type: DataTypes.ENUM("Gold", "Silver"),
    allowNull: false,
  },

  category: {
    type: DataTypes.STRING, // Ring, Chain, Coin etc
    allowNull: false,
  },

  details: {
    type: DataTypes.TEXT,
  },

  //  Purity & Weight
  purity: {
    type: DataTypes.STRING, // 22K, 18K, 925
    allowNull: false,
  },

  gross_weight: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },

  net_weight: {
    type: DataTypes.FLOAT,
  },

  stone_weight: {
    type: DataTypes.FLOAT,
  },

  //  Stone
  stone_amount: {
    type: DataTypes.FLOAT,
  },

  //  Making Charges

  making_charge: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },

  //  Pricing
  purchase_rate: {
    type: DataTypes.FLOAT,
  },

  sale_rate: {
    type: DataTypes.FLOAT,
  },

  //  Tax
  hsn_code: {
    type: DataTypes.STRING,
  },

  //  Unit
  unit: {
    type: DataTypes.ENUM("gram", "piece"),
    defaultValue: "gram",
  },

  //  Status Tracking 
  current_status: {
    type: DataTypes.ENUM(
      "in_stock",
      "sold",
      "transit",
      "reserved",
      "exchange",
      "returned",
      "damaged"
    ),
    defaultValue: "in_stock",
  },

  // Branch / Store
  branch_id: {
    type: DataTypes.INTEGER,
  },

}, {
  timestamps: true,
  tableName: "items",
});

export default Item;