import District from "../model/District.js";

/**
 * @route GET /api/districts/:state_id
 * @desc Get districts by state
 */
export const getDistrictsByState = async (req, res) => {
  try {
    const { state_id } = req.params;

    const districts = await District.findAll({
      where: { state_id },
    });

    res.json({
      success: true,
      data: districts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};