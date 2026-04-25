import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const InvoiceItem = sequelize.define(
  "InvoiceItem",
  {
    invoice_id: DataTypes.INTEGER,
    
    item_id: {   
      type: DataTypes.INTEGER,
      allowNull: false
    },

    quantity: {  
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    stone_weight: {
  type: DataTypes.DECIMAL(10,3),
  defaultValue: 0
},

    product_code: DataTypes.STRING,
    description: DataTypes.STRING,
    hsn_code: DataTypes.STRING,
    purity: DataTypes.STRING,
    gross_weight: DataTypes.DECIMAL(10, 3),
    less_weight: DataTypes.DECIMAL(10, 3),
    net_weight: DataTypes.DECIMAL(10, 3),
    rate: DataTypes.DECIMAL(12, 2),
    value: DataTypes.DECIMAL(15, 2),
    making_charge_percent: DataTypes.DECIMAL(5, 2),
    making_charge_value: DataTypes.DECIMAL(15, 2),
    total_amount: DataTypes.DECIMAL(15, 2),
  },
  {
    tableName: "invoice_items",
    timestamps: true,
  }
);
export default InvoiceItem;