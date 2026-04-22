
import sequelize from "../config/db.js";
import { QueryTypes } from "sequelize";
import User from "../models/User.js";
import bcrypt from "bcrypt";
import ExcelJS from "exceljs";

/**
 *  STAFF DASHBOARD STATS
 */
export const getStaffStats = async (req, res) => {
  try {
    const data = await sequelize.query(`
      SELECT 
        COUNT(*) AS total_staff,
        COUNT(*) FILTER (WHERE is_active = true) AS active,
        COUNT(*) FILTER (WHERE is_active = false) AS on_leave,
        COUNT(DISTINCT role) AS departments
      FROM public.users   
    `, { type: QueryTypes.SELECT });

    res.json({ success: true, data: data[0] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 *  GET ALL STAFF
 */
export const getAllStaff = async (req, res) => {
  try {
    const data = await sequelize.query(`
      SELECT 
        id,
        name AS username,
        email,
        phone_number,
        store_name,
        user_code,
        role,
        is_police_verified,
        store_code,
        is_active,
        created_at
      FROM public.users 
      ORDER BY id DESC
    `, { type: QueryTypes.SELECT });

    res.json({ success: true, data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 *  EXPORT STAFF (EXCEL)
 */
export const exportStaffExcel = async (req, res) => {
  try {
    const staff = await sequelize.query(`
      SELECT 
        id,
        name AS username,
        email,
        phone_number,
        store_name,
        user_code,
        role,
        is_police_verified,
        store_code,
        is_active,
        created_at
      FROM public.users   
      ORDER BY id DESC
    `, { type: QueryTypes.SELECT });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Staff Report");

    //  TITLE
    sheet.mergeCells("A1:K1");
    sheet.getCell("A1").value = "Staff Management Report";
    sheet.getCell("A1").font = { size: 16, bold: true };
    sheet.getCell("A1").alignment = { horizontal: "center" };

    sheet.addRow([]);

    //  HEADER
    const header = [
      "ID",
      "Name",
      "Email",
      "Phone",
      "Store",
      "Employee Code",
      "Role",
      "Police Verified",
      "Store Code",
      "Status",
      "Created At"
    ];

    sheet.addRow(header);
    sheet.getRow(3).font = { bold: true };

    //  DATA
    staff.forEach((s) => {
      sheet.addRow([
        s.id,
        s.username,
        s.email,
        s.phone_number,
        s.store_name,
        s.user_code,
        s.role,
        s.is_police_verified ? "Yes" : "No",
        s.store_code,
        s.is_active ? "Active" : "On Leave",
        s.created_at ? new Date(s.created_at).toLocaleString() : ""
      ]);
    });

    sheet.columns.forEach(col => col.width = 20);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=staff-report.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


/**
 *  GET SINGLE STAFF
 */
export const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ error: "Staff not found" });
    }

    res.json({ success: true, data: user });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 *  ADD EMPLOYEE
 */
export const addEmployee = async (req, res) => {
  try {
    const {
      email,
      username,
      password,
      role,
      storeCode,
      phoneNumber,
      storeName,
      organizationLevel
    } = req.body;

    if (!email || !username || !password || !storeCode) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      username,
      password: hashedPassword,
      role,
      storeCode,
      phoneNumber,
      storeName,
      organizationLevel,
      userCode: "USR-" + Date.now(),
      isActive: true
    });

    res.status(201).json({
      success: true,
      data: user
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 *  UPDATE EMPLOYEE
 */
export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "Staff not found" });
    }

    await user.update(req.body);

    res.json({
      success: true,
      data: user
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 *  DELETE EMPLOYEE
 */
export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "Staff not found" });
    }

    await user.destroy();

    res.json({
      success: true,
      message: "Employee deleted"
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 *  TOGGLE ACTIVE / LEAVE
 */
export const toggleEmployeeStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "Staff not found" });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: "Status updated",
      isActive: user.isActive
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

