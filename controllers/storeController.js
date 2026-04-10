import Store from "../models/Store.js";
import District from "../models/District.js";

/**
 *  Check SuperAdmin
 */
const isSuperAdmin = (req) => {
  return req.user?.role === "SuperAdmin";
};

/**
 * @desc Register Store (RBAC + FK + Roles)
 */
export const registerStore = async (req, res) => {
  try {
  
    if (req.headers.role !== "SuperAdmin") {
      return res.status(403).json({
        message: "Only SuperAdmin can create Store",
      });
    }

    const data = req.body;

    const exists = await Store.findOne({
      where: { store_code: data.store_code },
    });

    if (exists) {
      return res.status(400).json({
        message: "Store already exists",
      });
    }


    if (data.district_id) {
      const district = await District.findByPk(data.district_id);

      if (!district) {
        return res.status(400).json({
          message: "Invalid district_id",
        });
      }
    }


    const store = await Store.create({
      ...data,

    });

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
 * @desc Bulk Create Stores (RBAC + FK + Roles)
 */
export const bulkCreateStores = async (req, res) => {
  try {
   
    if (!isSuperAdmin(req)) {
      return res.status(403).json({
        message: "Only SuperAdmin can create Stores",
      });
    }

    const stores = req.body;

    
    const districtIds = stores
      .map((s) => s.district_id)
      .filter((id) => id !== null && id !== undefined);

 
    const validDistricts = await District.findAll({
      where: { id: districtIds },
      attributes: ["id"],
    });

    const validIds = validDistricts.map((d) => d.id);

 
    const invalidStores = stores.filter(
      (s) => s.district_id && !validIds.includes(s.district_id)
    );

    if (invalidStores.length > 0) {
      return res.status(400).json({
        message: "Some district_ids are invalid",
        invalidStores,
      });
    }

    const storesWithRoles = stores.map((store) => ({
      ...store,
    }));

   
    const result = await Store.bulkCreate(storesWithRoles);

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


export const getStoresByDistrict = async (req, res) => {
  try {
    const { district_id } = req.params;

    const stores = await Store.findAll({
      where: { district_id },

      include: [
        {
          model: District, 
        },
      ],
    });

    res.status(200).json({
      success: true,
      data: stores,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};