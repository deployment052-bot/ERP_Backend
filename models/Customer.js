import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Customer = sequelize.define(
  "Customer",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    phone: {
      type: DataTypes.STRING,
      validate: {
        isNumeric: true,
        len: [10, 15],
      },
    },

    address: {
      type: DataTypes.TEXT,
    },

    organization_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    store_code: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "customers",
    timestamps: true,
    indexes: [
      { fields: ["organization_id"] },
      { fields: ["phone"] },
    ],
  }
);

export default Customer;