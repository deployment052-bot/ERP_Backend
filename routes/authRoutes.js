import express from "express";
import {
  register,
  login,
  forgotPassword,
  verifyOtp,
  resetPassword,
} from "../controllers/authController.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

/*
    @desc    Register a new user
    @route   POST /api/auth/register
    @access  Public
*/
router.post(
  "/register",
  upload.fields([
    { name: "policeDoc", maxCount: 1 },
    { name: "aadhaar", maxCount: 1 },
    { name: "pan", maxCount: 1 },
  ]),
  register
);

/*
  @desc    Login user
  @route   POST /api/auth/login
  @access  Public
*/
router.post("/login", login);

/*
  @desc    Send OTP to email for forgot password
  @route   POST /api/auth/forgot-password
  @access  Public
*/
router.post("/forgot-password", forgotPassword);

/*
  @desc    Verify OTP for password reset
  @route   POST /api/auth/verify-otp
  @access  Public
*/
router.post("/verify-otp", verifyOtp);

/*
  @desc    Reset password using OTP
  @route   POST /api/auth/reset-password
  @access  Public
*/
router.post("/reset-password", resetPassword);

export default router;