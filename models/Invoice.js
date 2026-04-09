import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Invoice = sequelize.define(
  "Invoice",
  {
    invoice_number: DataTypes.STRING,

    customer_id: DataTypes.INTEGER,

    total_amount: DataTypes.FLOAT,

    received_amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    pending_amount: DataTypes.FLOAT,

    status: {
      type: DataTypes.ENUM("PAID", "PARTIAL", "UNPAID"),
      defaultValue: "UNPAID",
    },

    invoice_date: DataTypes.DATE,

    organization_id: DataTypes.INTEGER,
  },
  {
    tableName: "invoices",
    timestamps: true,
  }
);

export default Invoice;