import bcrypt from "bcrypt"; 
import { Store } from "../models/index.js";
import User from "../models/User.js";

/**
 * @desc Check Store Exists
 */
export const createUsersForStore = async (req, res) => {
  try {
    console.log("BODY:", req.body);

    const { store_code } = req.body;

    if (!store_code) {
      return res.status(400).json({
        success: false,
        message: "store_code is required",
      });
    }

    const store = await Store.findOne({
      where: { store_code: store_code },
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    return res.json({
      success: true,
      message: "Store found",
      store,
    });

  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};


/**
 * @desc Bulk Create Users for Store
 */
export const bulkCreateUsers = async (req, res) => {
  try {
    const users = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Users array required",
      });
    }

    const store_code = users[0]?.store_code;

    if (!store_code) {
      return res.status(400).json({
        success: false,
        message: "store_code required in users",
      });
    }

    const store = await Store.findOne({
      where: { store_code: store_code },
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    
    const preparedUsers = await Promise.all(
      users.map(async (user) => ({
        name: user.name || null,
        email: user.email,
        username: user.username,
        phoneNumber: user.phone_number || null,
        role: user.role || "user",

        password: await bcrypt.hash(user.password, 10), 

        storeCode: store_code,
        storeName: store.store_name,
        organizationLevel: store.organizationlevel,

        userCode: user.user_code || null,
      }))
    );

    const result = await User.bulkCreate(preparedUsers, {
      ignoreDuplicates: true,
    });

    return res.status(201).json({
      success: true,
      message: "Users created successfully",
      count: result.length,
      data: result,
    });

  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};