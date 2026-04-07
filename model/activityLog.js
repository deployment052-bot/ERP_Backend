import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ActivityLog = sequelize.define(
  "ActivityLog",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    branch_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    meta: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    icon: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "activity",
    },

    color: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "blue",
    },
  },
  {
    tableName: "activity_logs",
    timestamps: true,
  }
);

export default ActivityLog;