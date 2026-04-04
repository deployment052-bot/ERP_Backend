import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const StockTransfer = sequelize.define(
  "StockTransfer",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    transfer_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },

    request_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    // Store.id
    from_organization_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },

    // Store.id
    to_organization_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },

    transfer_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    dispatch_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    receive_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "draft",
        "approved",
        "dispatched",
        "in_transit",
        "received",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "draft",
    },

    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    approved_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    dispatched_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    received_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    created_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
  },
  {
    tableName: "stock_transfers",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { unique: true, fields: ["transfer_no"] },
      { fields: ["status"] },
      { fields: ["from_organization_id"] },
      { fields: ["to_organization_id"] },
      { fields: ["transfer_date"] },
    ],
  }
);

export default StockTransfer;