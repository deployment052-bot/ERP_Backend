import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Task = sequelize.define(
  "Task",
  {
    title: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    priority: { type: DataTypes.STRING, defaultValue: "medium" },
    status: { type: DataTypes.STRING, defaultValue: "pending" },
    task_type: DataTypes.STRING,
    reference_id: DataTypes.INTEGER,
    reference_no: DataTypes.STRING,
    state_code: DataTypes.STRING,
    district_code: DataTypes.STRING,
    store_code: DataTypes.STRING,
    store_name: DataTypes.STRING,
    assigned_to: DataTypes.INTEGER,
    created_by: DataTypes.INTEGER,
  },
  {
    tableName: "tasks",
    timestamps: false,
  }
);

export default Task;