import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const LedgerEntry = sequelize.define(
  "LedgerEntry",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    customer_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("DEBIT", "CREDIT"),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    reference_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reference_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    organization_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
  },
  {
    tableName: "ledger_entries",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default LedgerEntry;