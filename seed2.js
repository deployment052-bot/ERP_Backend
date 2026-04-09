export const getStockList = async (req, res) => {
  try {
    const user = req.user;
    const { search, category, metal_type, organization_id } = req.query;

    let orgId = null;

    if (user?.role === "super_admin") {
      orgId = organization_id ? Number(organization_id) : null;
    } else {
      orgId = user?.organization_id ? Number(user.organization_id) : null;
    }

    if (!user?.role) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (user.role !== "super_admin" && !orgId) {
      return res.status(403).json({
        success: false,
        message: "Organization not found for this user",
      });
    }

    const itemWhere = {};
    const stockWhere = {};

    if (orgId) {
      itemWhere.organization_id = orgId;
      stockWhere.organization_id = orgId;
    }

    if (category) itemWhere.category = category;
    if (metal_type) itemWhere.metal_type = metal_type;

    if (search) {
      itemWhere[Op.or] = [
        { category: { [Op.iLike]: `%${search}%` } },
        { article_code: { [Op.iLike]: `%${search}%` } },
        { item_name: { [Op.iLike]: `%${search}%` } },
        { purity: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const items = await Item.findAll({
      attributes: [
        "id",
        "category",
        "article_code",
        "sale_rate",
        "making_charge",
        "purity",
        "net_weight",
        "stone_weight",
        "gross_weight",
        "organization_id",
      ],
      where: itemWhere,
      include: [
        {
          model: Stock,
          as: "stocks",
          required: false,
          attributes: ["id", "organization_id", "available_qty"],
          where: Object.keys(stockWhere).length ? stockWhere : undefined,
        },
      ],
      order: [["id", "DESC"]],
    });

    const grouped = {};

    for (const item of items) {
      const stock = Array.isArray(item.stocks) ? item.stocks[0] : null;
      const categoryKey = item.category || "Other";

      if (!grouped[categoryKey]) {
        grouped[categoryKey] = {
          category: categoryKey,
          code: item.article_code || "-",
          quantity: 0,
          selling_price: Number(item.sale_rate || 0),
          making_charge: Number(item.making_charge || 0),
          purity: item.purity || "-",
          net_weight: 0,
          stone_weight: 0,
          gross_weight: 0,
          action: "View",
        };
      }

      grouped[categoryKey].quantity += Number(stock?.available_qty || 0);
      grouped[categoryKey].net_weight += Number(item.net_weight || 0);
      grouped[categoryKey].stone_weight += Number(item.stone_weight || 0);
      grouped[categoryKey].gross_weight += Number(item.gross_weight || 0);
    }

    const data = Object.values(grouped).map((row) => ({
      ...row,
      quantity: Number(row.quantity.toFixed(3)),
      net_weight: Number(row.net_weight.toFixed(3)),
      stone_weight: Number(row.stone_weight.toFixed(3)),
      gross_weight: Number(row.gross_weight.toFixed(3)),
    }));

    return res.status(200).json({
      success: true,
      message: "Branch-wise stock fetched successfully",
      organization_id: orgId,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getStockList error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stock list",
      error: error.message,
    });
  }
};


/* =========================================================
   STOCK OF ALL CATOGARY
========================================================= */



export const getStockItemsByCategory = async (req, res) => {
  try {
    const user = req.user;
    const { category } = req.params;
    const { organization_id, search, metal_type } = req.query;

    let orgId = null;

    // =========================
    // Resolve organization
    // =========================
    if (user?.role === "super_admin") {
      orgId = organization_id ? Number(organization_id) : null;
    } else {
      orgId = user?.organization_id ? Number(user.organization_id) : null;
    }

    if (!user?.role) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (user.role !== "super_admin" && !orgId) {
      return res.status(403).json({
        success: false,
        message: "Organization not found for this user",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    // =========================
    // Filters
    // =========================
    const itemWhere = { category };
    const stockWhere = {};

    if (orgId) {
      itemWhere.organization_id = orgId;
      stockWhere.organization_id = orgId;
    }

    if (metal_type) {
      itemWhere.metal_type = metal_type;
    }

    if (search) {
      itemWhere[Op.or] = [
        { item_name: { [Op.iLike]: `%${search}%` } },
        { article_code: { [Op.iLike]: `%${search}%` } },
        { sku_code: { [Op.iLike]: `%${search}%` } },
        { purity: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // =========================
    // Fetch items
    // =========================
    const items = await Item.findAll({
      attributes: [
        "id",
        "article_code",
        "sku_code",
        "item_name",
        "metal_type",
        "category",
        "details",
        "purity",
        "gross_weight",
        "net_weight",
        "stone_weight",
        "stone_amount",
        "making_charge",
        "purchase_rate",
        "sale_rate",
        "hsn_code",
        "unit",
        "current_status",
        "organization_id",
        "createdAt",
        "updatedAt",
      ],
      where: itemWhere,
      include: [
        {
          model: Stock,
          as: "stocks",
          required: false,
          where: Object.keys(stockWhere).length ? stockWhere : undefined,
          attributes: [
            "id",
            "organization_id",
            "item_id",
            "available_qty",
            "available_weight",
            "reserved_qty",
            "reserved_weight",
            "transit_qty",
            "transit_weight",
            "damaged_qty",
            "damaged_weight",
            "dead_qty",
            "dead_weight",
          ],
        },
        {
          model: Store,
          as: "organization",
          required: false,
          attributes: ["id", "store_code", "store_name", "organization_level"],
        },
      ],
      order: [["id", "DESC"]],
    });

    // =========================
    // Flatten response
    // =========================
    const data = items.map((item, index) => {
      const stock =
        Array.isArray(item.stocks) && item.stocks.length > 0
          ? item.stocks[0]
          : null;

      return {
        idx: index,
        id: Number(item.id || 0),
        article_code: item.article_code || "",
        sku_code: item.sku_code || "",
        item_name: item.item_name || "",
        metal_type: item.metal_type || "",
        category: item.category || "",
        details: item.details || "",
        purity: item.purity || "",

        gross_weight: Number(item.gross_weight || 0),
        net_weight: Number(item.net_weight || 0),
        stone_weight: Number(item.stone_weight || 0),
        stone_amount: Number(item.stone_amount || 0),

        making_charge: Number(item.making_charge || 0),
        purchase_rate: Number(item.purchase_rate || 0),
        sale_rate: Number(item.sale_rate || 0),

        hsn_code: item.hsn_code || "",
        unit: item.unit || "",
        current_status: item.current_status || "",

        // stock fields
        stock_id: stock ? Number(stock.id || 0) : null,
        quantity: Number(stock?.available_qty || 0),
        available_qty: Number(stock?.available_qty || 0),
        available_weight: Number(stock?.available_weight || 0),
        reserved_qty: Number(stock?.reserved_qty || 0),
        reserved_weight: Number(stock?.reserved_weight || 0),
        transit_qty: Number(stock?.transit_qty || 0),
        transit_weight: Number(stock?.transit_weight || 0),
        damaged_qty: Number(stock?.damaged_qty || 0),
        damaged_weight: Number(stock?.damaged_weight || 0),
        dead_qty: Number(stock?.dead_qty || 0),
        dead_weight: Number(stock?.dead_weight || 0),

        // store / org fields
        store_id: item.organization ? Number(item.organization.id || 0) : null,
        storeCode: item.organization?.store_code || null,
        storeName: item.organization?.store_name || null,
        organization_level: item.organization?.organization_level || null,
        organization_id: Number(item.organization_id || 0),

        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null,

        action: "View",
      };
    });

    return res.status(200).json({
      success: true,
      message: `${category} items fetched successfully`,
      organization_id: orgId,
      category,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("getStockItemsByCategory error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch category items",
      error: error.message,
    });
  }
};