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

    // =========================================================
    // MODULE CONTEXT
    // inventory_audit / inventory_audit_item / inventory_followup /
    // inventory_investigation / stock_request / stock_transfer etc.
    // =========================================================
    module: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    // audit / audit_item / followup / investigation / request / transfer
    entity_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    // current entity id
    entity_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    // parent link
    // ex:
    // entity_type = audit_item, parent_entity_type = audit
    // entity_type = investigation, parent_entity_type = audit_item
    parent_entity_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    parent_entity_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    // =========================================================
    // ACTION
    // create / submit / review / approve / reject / mark_missing /
    // reminder_sent / reason_submitted / escalate / investigation_open /
    // item_found / police_case / close
    // =========================================================
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    // short status snapshot at time of log
    status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // priority / severity for investigation cases
    severity: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },

    // =========================================================
    // ORGANIZATION CONTEXT
    // =========================================================
    organization_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    organization_level: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },

    parent_organization_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    visible_to_organization_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    store_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    store_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    district_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    district_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // =========================================================
    // USER CONTEXT
    // =========================================================
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    assigned_to: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    // system reminder / auto event
    is_system_generated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // =========================================================
    // BUSINESS REFERENCE
    // AUD-001 / INV-001 / REQ-001 / TRF-001
    // =========================================================
    reference_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // audit date or business date
    audit_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    // item-level business info
    item_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    article_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    sku_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    item_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // =========================================================
    // SNAPSHOTS
    // =========================================================
    old_values: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    new_values: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    // =========================================================
    // DESCRIPTION
    // =========================================================
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // explanation / reason in missing item flow
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // investigation final note / followup response
    resolution_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // =========================================================
    // REQUEST INFO
    // =========================================================
    ip_address: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // actual event timestamp
    event_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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
      { fields: ["parent_entity_type", "parent_entity_id"] },
      { fields: ["organization_id"] },
      { fields: ["parent_organization_id"] },
      { fields: ["visible_to_organization_id"] },
      { fields: ["store_id"] },
      { fields: ["district_id"] },
      { fields: ["user_id"] },
      { fields: ["assigned_to"] },
      { fields: ["action"] },
      { fields: ["status"] },
      { fields: ["severity"] },
      { fields: ["reference_no"] },
      { fields: ["audit_date"] },
      { fields: ["item_id"] },
      { fields: ["article_code"] },
      { fields: ["event_time"] },
      { fields: ["created_at"] },
    ],
  }
);

export default AuditTrail;