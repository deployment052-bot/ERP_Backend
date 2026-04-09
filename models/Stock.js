import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Stock = sequelize.define(
  "Stock",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    available_qty: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    available_weight: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    reserved_qty: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    reserved_weight: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    transit_qty: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    transit_weight: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    damaged_qty: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    damaged_weight: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
  },
  {
    tableName: "stocks",      
    freezeTableName: true,    
    timestamps: false,       
  }
);

export default Stock;