import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";


export const extractTextFromPDF = async (filePath) => {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      let lastY = null;

      content.items.forEach((item) => {
        if (lastY !== item.transform[5]) {
          text += "\n";
          lastY = item.transform[5];
        }
        text += item.str + " ";
      });

      text += "\n";
    }

    console.log(" PDF TEXT EXTRACTED");
    return text;
  } catch (error) {
    console.error(" PDF Parsing Failed:", error);
    throw error;
  }
};


export const extractJSONFromText = (text) => {
  try {
    //  Find JSON block
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");

    if (start === -1 || end === -1) {
      console.log(" JSON block not found");
      return [];
    }

    let jsonString = text.slice(start, end + 1);

    //  Clean unwanted characters
    jsonString = jsonString
      .replace(/\n/g, "")
      .replace(/\r/g, "")
      .replace(/\t/g, "")
      .replace(/\s+/g, " "); // normalize spaces

    //  Fix common OCR issues
    jsonString = jsonString.replace(/,\s*}/g, "}"); // trailing comma fix

    const items = JSON.parse(jsonString);

    console.log(" JSON PARSED SUCCESSFULLY");
    return items;
  } catch (err) {
    console.error(" JSON Parse Failed:", err.message);
    return [];
  }
};


export const validateItems = (items) => {
  const validItems = [];
  const errors = [];

  items.forEach((item, index) => {
    try {
      
      if (!item.article_code || !item.item_name || !item.metal_type) {
        throw new Error("Missing required fields");
      }

      
      const cleanedItem = {
        article_code: item.article_code,
        sku_code: item.sku_code || null,
        item_name: item.item_name,
        metal_type: item.metal_type,
        category: item.category || "General",
        details: item.details || null,
        purity: item.purity || "N/A",

        gross_weight: parseFloat(item.gross_weight) || 0,
        net_weight: parseFloat(item.net_weight) || 0,
        stone_weight: parseFloat(item.stone_weight) || 0,

        stone_amount: parseFloat(item.stone_amount) || 0,
        making_charge: parseFloat(item.making_charge) || 0,

        purchase_rate: parseFloat(item.purchase_rate) || 0,
        sale_rate: parseFloat(item.sale_rate) || 0,

        hsn_code: item.hsn_code || "7113",
        unit: item.unit || "gram",
        current_status: item.current_status || "in_stock",

        store_id: item.store_id || null,
        storeCode: item.storeCode || null,
        storeName: item.storeName || null,

        is_active: item.is_active !== false,
      };

      validItems.push(cleanedItem);
    } catch (err) {
      errors.push({
        index,
        error: err.message,
        item,
      });
    }
  });

  console.log(" VALID ITEMS:", validItems.length);
  console.log(" INVALID ITEMS:", errors.length);

  return { validItems, errors };
};


export const processOCR = async (filePath) => {
  try {
    // Step 1: Extract text
    const text = await extractTextFromPDF(filePath);
    console.log(" RAW TEXT:\n", text);

    // Step 2: Extract JSON
    const rawItems = extractJSONFromText(text);

    if (!rawItems.length) {
      console.log(" No items extracted");
      return [];
    }

    // Step 3: Validate & clean
    const { validItems, errors } = validateItems(rawItems);

    if (errors.length) {
      console.log(" SOME ITEMS FAILED:", errors);
    }

    return validItems;
  } catch (error) {
    console.error(" OCR PROCESS FAILED:", error.message);
    return [];
  }
};