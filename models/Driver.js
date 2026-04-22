import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Driver = sequelize.define("Driver", {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },

  name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  vehicle_number: { type: DataTypes.STRING },

}, {
  tableName: "drivers",
  timestamps: false,
});

export default Driver;