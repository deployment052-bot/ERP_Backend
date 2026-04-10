import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const State = sequelize.define("State", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  roles: {
  type: DataTypes.JSON,
  allowNull: true,
  defaultValue: [],
}
}
,{
    tableName: "states",
    freezeTableName: true,
    timestamps: false,
});

export default State;