import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Bill = sequelize.define("Bill", {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true
  },

  bill_number: {
    type: DataTypes.STRING,
    unique: true
  },

  store_code: {
    type: DataTypes.STRING
  },
  total_amount: {
  type: DataTypes.DECIMAL(15,2),
  defaultValue: 0
},

  organization_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  }

}, {
  tableName: "bills",
  timestamps: true
});

export default Bill;