import { State, District, Store, Stock, Item } from "../models/index.js";

// Get States
export const getStates = async (req, res) => {
  try {
    const data = await State.findAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Districts by State
export const getDistrictsByState=async(req,res)=>{
    try{
        const {stateId}=req.params;
        const data=await District.findAll({
            where:{state_id:stateId}
            
        })
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// Get Stores by District
export const getStoresByDistrict = async (req, res) => {
  try {
    const { districtId } = req.params;

    const data = await Store.findAll({
      where: { district_id: districtId },
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Stocks with Item 
export const getStocksByStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    const data = await Stock.findAll({
      where: { organization_id: storeId },
      include: [
        {
          model: Item,
        },
      ],
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getFullHierarchy = async (req, res) => {
  try {
    const data = await State.findAll({
      include: [
        {
          model: District,
          include: [
            {
              model: Store,
              include: [
                {
                  model: Item,
                  include: [Stock],
                },
              ],
            },
          ],
        },
      ],
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};