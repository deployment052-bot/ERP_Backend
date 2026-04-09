import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Transaction = sequelize.define(
  "Transaction",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    transaction_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    transaction_type: {
      type: DataTypes.STRING,
    },

    organization_id: {
      type: DataTypes.INTEGER,
    },
  },
  {
    tableName: "transactions",
    timestamps: true,
  }
);

export default Transaction;