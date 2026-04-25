import sequelize from "../config/db.js";
import { QueryTypes } from "sequelize";
import redisClient from "../config/redis.js";
import eventBus from "../utils/eventBus.js";

// ==========================================
// 🔥 LISTENER (run once when file loads)
// ==========================================
eventBus.on("HEAD_OFFICE_INVALIDATE", async () => {
  try {
    console.log("🔥 HEAD OFFICE CACHE INVALIDATE EVENT RECEIVED");

    const keys = await redisClient.keys("headOffice:*");

    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log("🗑️ Deleted Keys:", keys);
    } else {
      console.log("⚠️ No cache keys found");
    }

  } catch (err) {
    console.error("❌ Cache Invalidation Error:", err);
  }
});


// ==========================================
// 🧠 GET HEAD OFFICE STOCK (CACHE ASIDE)
// ==========================================
export const getHeadOfficeStock = async (req, res) => {
  try {
    const { search = "", category = "" } = req.query;

    const user = {
      organization_level: req.headers.organization_level,
      store_code: req.headers.store_code,
    };

    if (user.organization_level !== "head_office") {
      return res.status(403).json({ message: "Access denied" });
    }

    // 🔑 UNIQUE CACHE KEY (VERY IMPORTANT)
    const cacheKey = `headOffice:${user.store_code}:${search}:${category}`;

    // ==========================================
    // 1️⃣ CACHE CHECK
    // ==========================================
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      console.log("⚡ Cache Hit: Head Office");
      return res.json(JSON.parse(cached));
    }

    console.log("🐢 Cache Miss: Head Office");

    // ==========================================
    // 2️⃣ DB QUERY (YOUR ORIGINAL CODE)
    // ==========================================
    const summary = await sequelize.query(
      `
      SELECT
        COUNT(i.id) AS total_items,

        COUNT(
          CASE 
            WHEN i."createdAt" < NOW() - INTERVAL '90 days'
            THEN 1
          END
        ) AS dead_stock,

        COUNT(
          CASE 
            WHEN s.available_qty < 25
            THEN 1
          END
        ) AS low_stock,

        COALESCE(SUM(s.transit_qty), 0) AS transit_stock

      FROM items i

      LEFT JOIN stocks s 
        ON i.id = s.item_id

      LEFT JOIN stores st 
        ON st.id = s.organization_id

      WHERE st.store_code = :storeCode;
      `,
      {
        replacements: {
          storeCode: user.store_code,
        },
        type: QueryTypes.SELECT,
      }
    );

    const inventory = await sequelize.query(
      `
      SELECT 
        i.id,
        i.item_name AS item,
        i.article_code AS code,
        COALESCE(s.available_qty, 0) AS quantity,
        i.purchase_rate AS purchase_price,
        i.sale_rate AS selling_price,
        i.making_charge,
        i.purity,
        ROUND(i.net_weight::numeric, 3) AS net_weight,
        ROUND(i.stone_weight::numeric, 3) AS stone_weight,
        ROUND(i.gross_weight::numeric, 3) AS gross_weight

      FROM items i

      LEFT JOIN stocks s 
        ON i.id = s.item_id

      LEFT JOIN stores st 
        ON st.id = s.organization_id

      WHERE 
        st.store_code = :storeCode
        AND (:search = '' OR i.item_name ILIKE '%' || :search || '%')
        AND (:category = '' OR i.category = :category)

      ORDER BY i."createdAt" DESC;
      `,
      {
        replacements: {
          storeCode: user.store_code,
          search,
          category,
        },
        type: QueryTypes.SELECT,
      }
    );

    const response = {
      success: true,
      data: {
        summary: {
          total_items: Number(summary[0]?.total_items || 0),
          dead_stock: Number(summary[0]?.dead_stock || 0),
          low_stock: Number(summary[0]?.low_stock || 0),
          transit_stock: Number(summary[0]?.transit_stock || 0),
        },
        inventory,
      },
    };

    // ==========================================
    // 3SAVE CACHE (TTL 60 sec)
    // ==========================================
    await redisClient.setEx(cacheKey, 60, JSON.stringify(response));

    console.log("💾 Cache Stored");

    return res.json(response);

  } catch (error) {
    console.error("Head Office Stock Error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};


// ==========================================
// 🔥 AUTO INVALIDATION FUNCTION (CALL THIS)
// ==========================================
export const invalidateHeadOfficeCache = () => {
  console.log("📢 Triggering HEAD OFFICE INVALIDATION");
  eventBus.emit("HEAD_OFFICE_INVALIDATE");
};