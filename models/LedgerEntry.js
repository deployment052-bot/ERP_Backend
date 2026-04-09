import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const LedgerEntry = sequelize.define(
  "LedgerEntry",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    customer_id: DataTypes.INTEGER,

    type: {
      type: DataTypes.ENUM("DEBIT", "CREDIT"),
    },

    amount: DataTypes.FLOAT,

    reference_type: DataTypes.STRING, // INVOICE / PAYMENT

    reference_id: DataTypes.INTEGER,

    description: DataTypes.STRING,
  },
  {
    tableName: "ledger_entries",
    timestamps: true,
  }
);

export default LedgerEntry;