import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const InvoiceItem = sequelize.define(
  "InvoiceItem",
  {
    invoice_id: DataTypes.INTEGER,

    product_code: DataTypes.STRING,
    description: DataTypes.STRING,
    hsn_code: DataTypes.STRING,

    purity: DataTypes.STRING,

    gross_weight: DataTypes.FLOAT,
    less_weight: DataTypes.FLOAT,
    net_weight: DataTypes.FLOAT,

    rate: DataTypes.FLOAT,
    value: DataTypes.FLOAT,

    making_charge_percent: DataTypes.FLOAT,
    making_charge_value: DataTypes.FLOAT,

    total_amount: DataTypes.FLOAT,
  },
  {
    tableName: "invoice_items",
    timestamps: true,
  }
);

export default InvoiceItem;