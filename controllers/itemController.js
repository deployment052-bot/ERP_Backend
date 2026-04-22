import Item from "../models/Item.js";

/**
 * @description Add a new item
 * @route POST /api/items
 * @access Private
 */
export const addItem = async (req, res) => {
  try {
    const {
      article_code,
      sku_code,
      item_name,
      metal_type,
      category,
      details,
      purity,
      gross_weight,
      net_weight,
      stone_weight,
      stone_amount,
      making_charge,
      purchase_rate,
      sale_rate,
      hsn_code,
      unit,
    } = req.body;

    const { role, reference_id } = req.user;

    //  Validation
    if (!article_code || !item_name || !metal_type || !category || !purity || !gross_weight || !making_charge) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    //  Check duplicate article_code
    const existingItem = await Item.findOne({
      where: { article_code },
    });

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: "Article code already exists",
      });
    }

    const newItem = await Item.create({
      article_code,
      sku_code,
      item_name,
      metal_type,
      category,
      details,
      purity,
      gross_weight,
      net_weight,
      stone_weight,
      stone_amount,
      making_charge,
      purchase_rate,
      sale_rate,
      hsn_code,
      unit,

      added_from_level: role.toLowerCase(), // CAPITAL → central
      reference_id: reference_id,
    });

    return res.status(201).json({
      success: true,
      message: "Item added successfully",
      data: newItem,
    });
  } catch (error) {
    console.error("Add Item Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};



//  GET OWN ITEMS (ROLE BASED)
export const getItems = async (req, res) => {
  try {
    const { role, reference_id } = req.user;

    let items;

    if (role === "CAPITAL") {
      items = await Item.findAll({
        order: [["createdAt", "DESC"]],
      });
    } else {
      items = await Item.findAll({
        where: { reference_id },
        order: [["createdAt", "DESC"]],
      });
    }

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Get Items Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching items",
    });
  }
};


/**
 * @description Get items by level
 * @route GET /api/items/levels/:level
 * @access Private
 */
export const getItemsByLevel = async (req, res) => {
  try {
    const { level } = req.params;

    const validLevels = ["central", "state", "district", "store"];

    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        message: "Invalid level",
      });
    }

    const items = await Item.findAll({
      where: {
        added_from_level: level,
      },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Get Items By Level Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching items",
    });
  }
};



/**
 * @description Get child items based on user role
 * @route GET /api/items/child
 * @access Private
 */
export const getChildItems = async (req, res) => {
  try {
    const { role } = req.user;

    let items = [];

    if (role === "STATE") {
      // State → district + store items
      items = await Item.findAll({
        where: {
          added_from_level: ["district", "store"],
        },
        order: [["createdAt", "DESC"]],
      });
    } 
    
    else if (role === "DISTRICT") {
      // District → store items
      items = await Item.findAll({
        where: {
          added_from_level: "store",
        },
        order: [["createdAt", "DESC"]],
      });
    } 
    
    else if (role === "CAPITAL") {
      // Capital → sab dekh sakta hai
      items = await Item.findAll({
        order: [["createdAt", "DESC"]],
      });
    } 
    
    else {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    console.error("Get Child Items Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching child items",
    });
  }
};



//  GET SINGLE ITEM
export const getItemById = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Get Item By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching item",
    });
  }
};



//  UPDATE ITEM
export const updateItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    await item.update(req.body);

    res.status(200).json({
      success: true,
      message: "Item updated successfully",
      data: item,
    });
  } catch (error) {
    console.error("Update Item Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating item",
    });
  }
};



//  DELETE ITEM
export const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Item.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    await item.destroy();

    res.status(200).json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("Delete Item Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting item",
    });
  }
};