import ActivityLog from "../models/ActivityLog.js";

export const getRecentActivities = async (req, res) => {
  try {
    const user = req.user;

    const where = {};

    // super admin sab dekhega
    if (user?.role !== "super_admin") {
      where.branch_id = user?.branch_id;
    }

    const activities = await ActivityLog.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: 15,
    });

    return res.status(200).json({
      success: true,
      message: "Recent activities fetched successfully",
      data: activities,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recent activities",
      error: error.message,
    });
  }
};