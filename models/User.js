import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import e from "express";

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    storeCode: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "store_code",
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },

    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    phoneNumber: {
      type: DataTypes.STRING,
      unique: true,
      field: "phone_number",
    },

    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "user",
    },

    isPoliceVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_police_verified",
    },

    policeDocUrl: {
      type: DataTypes.STRING,
      field: "police_doc_url",
    },

    aadhaarUrl: {
      type: DataTypes.STRING,
      field: "aadhaar_url",
    },

    panUrl: {
      type: DataTypes.STRING,
      field: "pan_url",
    },

    storeName: {
      type: DataTypes.STRING,
      field: "store_name",
    },

    organizationLevel: {
      type: DataTypes.STRING,
      field: "organization_level",
    },

    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    userCode: {
      type: DataTypes.STRING,
      unique: true,
      field: "user_code",
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "users",
    timestamps: false,
  }
);
export default User;