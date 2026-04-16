import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const BillItem = sequelize.define("BillItem", {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true
  },

  bill_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },

  item_id: DataTypes.BIGINT,
  product_code: DataTypes.STRING,
  description: DataTypes.STRING,

  net_weight: DataTypes.FLOAT,
  rate: DataTypes.FLOAT,

  making_charge_percent: DataTypes.FLOAT,
  making_charge_value: DataTypes.FLOAT,

  total_amount: DataTypes.FLOAT

}, {
  tableName: "bill_items",
  timestamps: true
});

export default BillItem;