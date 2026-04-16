import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
const  Invoice = sequelize.define("Invoice", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  total_amount: {
    type: DataTypes.DECIMAL(15,2),
  },

  pending_amount: {
    type: DataTypes.DECIMAL(15,2),
  },

  store_code: {
    type: DataTypes.STRING,
  },
  bill_id: {
  type: DataTypes.BIGINT
},

  organization_id: {   
    type: DataTypes.BIGINT,
    allowNull: false,
    field: "organization_id"
  }

}, {
  tableName: "invoices",
  timestamps: true
});
export default Invoice;