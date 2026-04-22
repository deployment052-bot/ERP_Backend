import { processOCR } from "../services/ocrService.js";
import Item from "../models/Item.js";

export const uploadAndProcessPDF = async (req, res) => {
  try {
    const filePath = req.file.path;

    const items = await processOCR(filePath);

    if (!items.length) {
      return res.status(400).json({
        message: "No items found in PDF",
      });
    }

    // ✅ NO OVERRIDE (IMPORTANT)
    const savedItems = await Item.bulkCreate(items);

    res.json({
      success: true,
      count: savedItems.length,
      data: savedItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OCR processing failed" });
  }
};