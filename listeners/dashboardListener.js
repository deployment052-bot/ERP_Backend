import redisClient from "../config/redis.js";
import eventBus from "../utils/eventBus.js";

eventBus.on("DASHBOARD_INVALIDATE", async () => {
  try {
    console.log(" Dashboard Cache Invalidating...");

    const keys = [
      "dashboard:advanced",
      "dashboard:cards",
      "dashboard:revenue",
      "dashboard:profit",
    ];

    await redisClient.del(keys);

    console.log(" Dashboard Cache Cleared");
  } catch (err) {
    console.error(" Cache Error:", err);
  }
});