import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Customer = sequelize.define(
  "Customer",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: "uq_customer_phone_store",
    },

    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    pan_card_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    pincode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    store_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: "uq_customer_phone_store",
    },

    organization_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },

    organization_level: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "customers",
    freezeTableName: true,
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

export default Customer;