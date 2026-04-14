import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Invoice = sequelize.define(
  "Invoice",
  {
    invoice_number: DataTypes.STRING,
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    customer_id: DataTypes.INTEGER,

    
    total_amount: DataTypes.DECIMAL(15, 2),
    received_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    pending_amount: DataTypes.DECIMAL(15, 2),
    status: {
      type: DataTypes.ENUM("PAID", "PARTIAL", "UNPAID"),
      defaultValue: "UNPAID",
    },
    invoice_date: DataTypes.DATE,
    organization_id: DataTypes.INTEGER,
   
    created_by: DataTypes.INTEGER,
    store_code: DataTypes.STRING,
  },
  {
    tableName: "invoices",
    timestamps: true,
  }
);

export default Invoice;