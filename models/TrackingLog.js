import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const TrackingLog = sequelize.define("TrackingLog", {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },

  transfer_id: { type: DataTypes.BIGINT },
  lat: { type: DataTypes.FLOAT },
  lng: { type: DataTypes.FLOAT },

}, {
  tableName: "tracking_logs",
  timestamps: true,
});

export default TrackingLog;