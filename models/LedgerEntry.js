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
    amount: DataTypes.DECIMAL(15, 2), 
    reference_type: DataTypes.STRING, 
    reference_id: DataTypes.INTEGER,
    description: DataTypes.STRING,
    organization_id: DataTypes.INTEGER,  
  },
  {
    tableName: "ledger_entries",
    timestamps: true,
  }
);

export default LedgerEntry;