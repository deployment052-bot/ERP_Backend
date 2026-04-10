import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const District = sequelize.define(
  "District",
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

    state_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    
  },
  {
    tableName: "districts",
    freezeTableName: true,
    timestamps: false,
  }
);

export default District;