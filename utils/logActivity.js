import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ActivityLog = sequelize.define(
  "ActivityLog",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    organization_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    user_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    module_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    reference_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    reference_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },

    icon: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "activity",
    },

    color: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "blue",
    },
  },
  {
    tableName: "activity_logs",
    timestamps: true,
    underscored: true,
  }
);

export default ActivityLog;