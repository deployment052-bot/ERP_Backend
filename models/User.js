import { DataTypes } from "sequelize"; 
import sequelize from "../config/db.js";

const User = sequelize.define(
  "User",
  {
    storeCode: {
      type: DataTypes.STRING,
      primaryKey: true, 
      allowNull: false,
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
      unique: true,
      allowNull: false,
    },

    phoneNumber: {
      type: DataTypes.STRING,
      unique: true,
    },

    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "user",
    },

    isPoliceVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    policeDocUrl: DataTypes.STRING,
    aadhaarUrl: DataTypes.STRING,
    panUrl: DataTypes.STRING,

    storeName: DataTypes.STRING,

    organizationLevel: DataTypes.STRING,

    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    userCode: {
      type: DataTypes.STRING,
      unique: true,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
  }
);
export default User;