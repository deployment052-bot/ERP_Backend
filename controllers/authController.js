import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import sequelize from "../config/db.js";
import cloudinary from "../utils/cloudinary.js";
// ================= REGISTER =================
export const register = async (req, res) => {
  try {
    const {
      email,
      username,
      password,
      role,
      organizationLevel,
      storeCode,
      phoneNumber,
      storeName
    } = req.body;

    if (!email || !username || !password || !role || !organizationLevel || !storeCode) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    if (phoneNumber) {
      const existingPhone = await User.findOne({ where: { phoneNumber } });
      if (existingPhone) {
        return res.status(400).json({ error: "Phone number already exists" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      username,
      password: hashedPassword,
      role,
      organizationLevel,
      storeCode,
      phoneNumber,
      storeName,
    });

    res.status(201).json({
      message: "User registered",
      user,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ================= LOGIN =================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Account inactive" });
    }

    const token = jwt.sign(
      { email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ================= FORGOT PASSWORD =================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    
    await sequelize.query(`
      UPDATE users 
      SET reset_otp = :hashedOtp,
          reset_otp_expire = CURRENT_TIMESTAMP + INTERVAL '24 hours',
          otp_attempts = 0
      WHERE email = :email
    `, {
      replacements: { hashedOtp, email },
      type: sequelize.QueryTypes.UPDATE
    });

    const html = `
      <h2>Password Reset OTP</h2>
      <p>Your OTP is: <b>${otp}</b></p>
      <p>Valid for 24 hours</p>
    `;

    await sendEmail(email, "Reset Password OTP", html);

    res.status(200).json({ message: "OTP sent to email" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ================= VERIFY OTP =================
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ error: "User not found" });

    if (user.otpAttempts >= 3) {
      return res.status(403).json({ error: "Too many attempts" });
    }

    const [result] = await sequelize.query(`
      SELECT 
        reset_otp,
        NOW() > reset_otp_expire AS expired
      FROM users
      WHERE email = :email
    `, {
      replacements: { email },
      type: sequelize.QueryTypes.SELECT
    });

    const otpMatch = result.reset_otp === hashedOtp;

    if (!otpMatch || result.expired) {
      await user.update({
        otpAttempts: (user.otpAttempts || 0) + 1
      });

      return res.status(400).json({
        error: "Invalid or expired OTP"
      });
    }

    res.status(200).json({ message: "OTP verified" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ================= RESET PASSWORD =================
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    //  DB VALIDATION
    const [result] = await sequelize.query(`
      SELECT 
        reset_otp,
        NOW() > reset_otp_expire AS expired
      FROM users
      WHERE email = :email
    `, {
      replacements: { email },
      type: sequelize.QueryTypes.SELECT
    });

    if (!result || result.reset_otp !== hashedOtp || result.expired) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.update({
      password: hashedPassword,
      resetOtp: null,
      resetOtpExpire: null,
      otpAttempts: 0,
    }, {
      where: { email }
    });

    res.status(200).json({
      message: "Password reset successful",
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};