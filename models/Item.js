import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Item = sequelize.define(
  "Item",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    article_code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    sku_code: {
      type: DataTypes.STRING,
      unique: true,
    },

    item_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    metal_type: {
      type: DataTypes.ENUM("Gold", "Silver"),
      allowNull: false,
    },

    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    details: {
      type: DataTypes.TEXT,
    },

    purity: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    gross_weight: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    net_weight: {
      type: DataTypes.FLOAT,
    },

    stone_weight: {
      type: DataTypes.FLOAT,
    },

    stone_amount: {
      type: DataTypes.FLOAT,
    },

    making_charge: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    purchase_rate: {
      type: DataTypes.FLOAT,
    },

    sale_rate: {
      type: DataTypes.FLOAT,
    },

    hsn_code: {
      type: DataTypes.STRING,
    },

    unit: {
  type: DataTypes.STRING, 
},

    current_status: {
      type: DataTypes.ENUM(
        "in_stock",
        "sold",
        "transit",
        "reserved",
        "exchange",
        "returned",
        "damaged"
      ),
      defaultValue: "in_stock",
    },

    
    store_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    storeCode: {
      type: DataTypes.STRING,
    },

    storeName: {
      type: DataTypes.STRING,
    },
  },
  

  {
    timestamps: false,
    tableName: "items",
  }
  
);

export default Item;