import ActivityLog from "../models/ActivityLog.js";

export const logActivity = async ({
  branch_id = null,
  user_id = null,
  action,
  title,
  description = "",
  meta = {},
  icon = "activity",
  color = "blue",
}) => {
  try {
    await ActivityLog.create({
      branch_id,
      user_id,
      action,
      title,
      description,
      meta,
      icon,
      color,
    });
  } catch (error) {
    console.error("Activity Log Error:", error.message);
  }
};