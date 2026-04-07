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

    // module (stock_request, stock_transfer, stock, etc.)
    module: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    // entity type (request, transfer, item, stock)
    entity_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    // entity id (request_id, transfer_id)
    entity_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    // action (create, approve, dispatch, receive, cancel, reject)
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    // organization context
    organization_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    // user who performed action
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    // human readable reference (REQ-123, TRF-456)
    reference_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // short title (UI friendly)
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // before change snapshot
    old_values: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    // after change snapshot
    new_values: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    // extra metadata
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    // description / remarks
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // request IP
    ip_address: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // browser/device info
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
      { fields: ["reference_no"] },
      { fields: ["created_at"] },
    ],
  }
);

export default AuditTrail;