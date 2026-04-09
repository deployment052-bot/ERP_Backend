import Store from "../models/Store.js";
import District from "../models/District.js"; // FK validation

/**
 * @desc Register Store (Safe with FK Check)
 */
export const registerStore = async (req, res) => {
  try {
    const data = req.body;

    //  Check duplicate
    const exists = await Store.findOne({
      where: { store_code: data.store_code },
    });

    if (exists) {
      return res.status(400).json({
        message: "Store already exists",
      });
    }

    //FK Validation 
    if (data.district_id) {
      const district = await District.findByPk(data.district_id);

      if (!district) {
        return res.status(400).json({
          message: "Invalid district_id",
        });
      }
    }

    const store = await Store.create(data);

    res.status(201).json({
      success: true,
      data: store,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @desc Bulk Create Stores (FK Safe)
 */
export const bulkCreateStores = async (req, res) => {
  try {
    const stores = req.body;

    // Extract all district_ids
    const districtIds = stores
      .map((s) => s.district_id)
      .filter((id) => id !== null && id !== undefined);

    // Check valid districts
    const validDistricts = await District.findAll({
      where: { id: districtIds },
      attributes: ["id"],
    });

    const validIds = validDistricts.map((d) => d.id);

    //  Filter invalid ones
    const invalidStores = stores.filter(
      (s) => s.district_id && !validIds.includes(s.district_id)
    );

    if (invalidStores.length > 0) {
      return res.status(400).json({
        message: "Some district_ids are invalid",
        invalidStores,
      });
    }

    const result = await Store.bulkCreate(stores);

    res.status(201).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Bulk insert failed" });
  }
};