import District from "../models/District.js";
import Store from "../models/Store.js";

/**
 *  Check SuperAdmin 
 */
const isSuperAdmin = (req) => {
  return req.headers.role === "SuperAdmin";
};

/**
 * @desc Create District
 */
export const createDistrict = async (req, res) => {
  try {
   
    if (!isSuperAdmin(req)) {
      return res.status(403).json({
        message: "Only SuperAdmin can create District",
      });
    }

    const { name, state_name } = req.body;

   
    if (!name || !state_name) {
      return res.status(400).json({
        message: "name and state_name are required",
      });
    }

  
    const exists = await District.findOne({
      where: { name, state_name },
    });

    if (exists) {
      return res.status(400).json({
        message: "District already exists in this state",
      });
    }

    
    const district = await District.create({
      name,
      state_name,

    });

    res.status(201).json({
      success: true,
      message: "District created successfully",
      data: district,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

/**
 * @desc Get Districts by State Name
 */
export const getDistrictByState = async (req, res) => {
  try {
    const { state_name } = req.params;

    const districts = await District.findAll({
      where: { state_name },

      include: [
        {
          model: Store,
        },
      ],
    });

    res.status(200).json({
      success: true,
      count: districts.length,
      data: districts,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
};