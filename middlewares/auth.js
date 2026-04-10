/**
 * Simple Role Middleware
 *
 */

export const checkRole = (role) => {
  return (req, res, next) => {
    const userRole = req.headers.role; 

    if (!userRole) {
      return res.status(401).json({
        message: "Role not provided in headers",
      });
    }

    if (userRole !== role) {
      return res.status(403).json({
        message: `Access denied. Only ${role} allowed`,
      });
    }

    next();
  };
};

/**
 * 🔥 Multiple Roles Support
 */
export const checkRoles = (roles = []) => {
  return (req, res, next) => {
    const userRole = req.headers.role;

    if (!userRole) {
      return res.status(401).json({
        message: "Role not provided in headers",
      });
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        message: `Access denied. Allowed roles: ${roles.join(", ")}`,
      });
    }

    next();
  };
};