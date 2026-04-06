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

    district_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    district_code: {
      type: DataTypes.STRING,
      unique: true,
    },

    state_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    tableName: "districts",
  }
);

export default District;