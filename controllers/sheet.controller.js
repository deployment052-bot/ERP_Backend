import { getSheetData } from "../Services/sheet.service.js";

export const getSheetDataController = async (req, res) => {
  try {
    const data = await getSheetData();

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};