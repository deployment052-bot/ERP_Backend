import "dotenv/config";
import { Op } from "sequelize";
import sequelize from "./config/db.js";
import Store from "./model/Store.js";
import Item from "./model/item.js";
import Stock from "./model/stockrecord.js";

const GOLD_CATEGORIES = [
  "Ring",
  "Chain",
  "Necklace",
  "Pendant",
  "Bangle",
  "Bracelet",
  "Mangalsutra",
  "Earring",
  "Nose Pin",
  "Coin",
];

const SILVER_CATEGORIES = [
  "Ring",
  "Chain",
  "Anklet",
  "Bracelet",
  "Bowl",
  "Glass",
  "Coin",
  "Pooja Item",
  "Payal",
  "Earring",
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDecimal(min, max, decimals = 3) {
  const num = Math.random() * (max - min) + min;
  return Number(num.toFixed(decimals));
}

function makeArticleCode(storeCode, metal, index) {
  return `${storeCode}-${metal}-${String(index).padStart(3, "0")}`;
}

function makeSkuCode(storeCode, metal, index) {
  return `SKU-${storeCode}-${metal}-${String(index).padStart(3, "0")}`;
}

async function createOrUpdateItemAndStock(
  store,
  metalType,
  categoryList,
  startIndex = 1,
  endIndex = 25
) {
  for (let i = startIndex; i <= endIndex; i++) {
    const category = randomFrom(categoryList);

    const grossWeight =
      metalType === "Gold"
        ? randomDecimal(3, 40)
        : randomDecimal(5, 80);

    const stoneWeight =
      metalType === "Gold"
        ? randomDecimal(0, 3)
        : randomDecimal(0, 2);

    const netWeight = Number((grossWeight - stoneWeight).toFixed(3));

    const metalCode = metalType === "Gold" ? "GLD" : "SLV";
    const purity = metalType === "Gold" ? "22K" : "925";

    const articleCode = makeArticleCode(store.store_code, metalCode, i);
    const skuCode = makeSkuCode(store.store_code, metalCode, i);

    const itemPayload = {
      article_code: articleCode,
      sku_code: skuCode,
      item_name: `${metalType} ${category} ${i} - ${store.store_name}`,
      metal_type: metalType,
      category,
      details: `${category} for ${store.store_name}`,
      purity,
      gross_weight: grossWeight,
      net_weight: netWeight,
      stone_weight: stoneWeight,
      stone_amount:
        metalType === "Gold"
          ? randomDecimal(1000, 15000, 2)
          : randomDecimal(100, 3000, 2),
      making_charge:
        metalType === "Gold"
          ? randomDecimal(500, 5000, 2)
          : randomDecimal(100, 1500, 2),
      purchase_rate:
        metalType === "Gold"
          ? randomDecimal(5000, 7000, 2)
          : randomDecimal(60, 90, 2),
      sale_rate:
        metalType === "Gold"
          ? randomDecimal(6500, 8500, 2)
          : randomDecimal(80, 130, 2),
      hsn_code: "7113",
      unit: "piece",
      current_status: "in_stock",
      organization_id: store.id,
    };

    // =========================
    // ITEM CREATE / UPDATE
    // =========================
    let item = await Item.findOne({
      where: { article_code: articleCode },
    });

    if (!item) {
      item = await Item.create(itemPayload);
      console.log(`   ➕ Item created: ${articleCode}`);
    } else {
      await item.update(itemPayload);
      console.log(`   ♻️ Item updated: ${articleCode}`);
    }

    // =========================
    // STOCK CREATE / UPDATE
    // =========================
    let stock = await Stock.findOne({
      where: {
        organization_id: store.id,
        item_id: item.id,
      },
    });

    const stockPayload = {
      organization_id: store.id,
      item_id: item.id,
      available_qty: 1,
      available_weight: grossWeight,
      reserved_qty: 0,
      reserved_weight: 0,
      transit_qty: 0,
      transit_weight: 0,
      damaged_qty: 0,
      damaged_weight: 0,
    };

    if (!stock) {
      await Stock.create(stockPayload);
      console.log(`   📦 Stock created: ${articleCode}`);
    } else {
      await stock.update(stockPayload);
      console.log(`   🔁 Stock updated: ${articleCode}`);
    }
  }
}

async function seedStoreItemsAndStock() {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");

    const stores = await Store.findAll({
      where: {
        is_active: true,
        organization_level: {
          [Op.in]: ["State", "District", "Retail"],
        },
      },
      raw: true,
    });

    console.log(`🏬 Total stores found: ${stores.length}`);

    for (const store of stores) {
      console.log(
        `\n🚀 Seeding for store: ${store.store_name} (${store.store_code})`
      );

      await createOrUpdateItemAndStock(store, "Gold", GOLD_CATEGORIES, 1, 25);
      await createOrUpdateItemAndStock(store, "Silver", SILVER_CATEGORIES, 1, 25);

      console.log(`✅ Done for ${store.store_name}`);
    }

    console.log("\n🎉 All store items + stock pushed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed Error:", error);
    process.exit(1);
  }
}

seedStoreItemsAndStock();