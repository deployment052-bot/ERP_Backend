import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
const LedgerEntry = sequelize.define("LedgerEntry", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

  customer_id: { type: DataTypes.INTEGER, allowNull: false },

  type: {
    type: DataTypes.ENUM("DEBIT", "CREDIT"),
    allowNull: false,
  },

  amount: {
    type: DataTypes.DECIMAL(15,2),
    allowNull: false,
  },

  reference_type: DataTypes.STRING,
  reference_id: DataTypes.INTEGER,

  description: DataTypes.STRING,

}, {
  tableName: "ledger_entries",
  timestamps: true,
});

export default LedgerEntry;