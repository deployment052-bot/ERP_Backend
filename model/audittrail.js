import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AuditTrail = sequelize.define(
  "AuditTrail",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    module: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    entity_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    entity_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    organization_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    user_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    old_values: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    new_values: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    ip_address: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "audit_trails",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      { fields: ["module"] },
      { fields: ["entity_type", "entity_id"] },
      { fields: ["organization_id"] },
      { fields: ["user_id"] },
      { fields: ["action"] },
    ],
  }
);

export default AuditTrail;