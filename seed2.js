import "dotenv/config";
import sequelize from "./config/db.js";

// register all models before sync
import "./model/user.js";
import "./model/State.js";
import "./model/District.js";
import "./model/Store.js";
import "./model/item.js";
import "./model/stockrecord.js";
import "./model/stockmovement.js";
import "./model/StockRequest.js";
import "./model/stockRequestItem.js";
import "./model/stockTransfer.js";
import "./model/stockTransferItem.js";
import "./model/audittrail.js";
import "./model/activityLog.js";

// if you have associations file, import it too
// import "./model/index.js";

import { seedInventoryHierarchyData } from "./seed.js";

(async () => {
  try {
    console.log("🚀 Seeder start ho raha hai...");

    await sequelize.authenticate();
    console.log("✅ DB connected");

    // WARNING: saara existing DB data delete ho jayega
    await sequelize.sync({ force: true });
    console.log("✅ All tables recreated");

    const result = await seedInventoryHierarchyData();
    console.log("✅ SEED DONE:", result);

    process.exit(0);
  } catch (error) {
    console.error("❌ SEED ERROR:", error);
    process.exit(1);
  }
})();