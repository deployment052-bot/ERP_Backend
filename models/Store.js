import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Store = sequelize.define(
  "Store",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    storeCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    storeName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    organizationLevel: {
      type: DataTypes.ENUM("head_office", "State", "District","Retail"),
      defaultValue: "branch",
    },

    state: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    district: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    district_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    address: {
      type: DataTypes.TEXT,
    },

    phoneNumber: {
      type: DataTypes.STRING,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    tableName: "stores",
  }
);

export default Store;