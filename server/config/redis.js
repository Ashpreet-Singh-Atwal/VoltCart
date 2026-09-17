const { createClient } = require("redis");
 
if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is required");
}
 
const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy(retries) {
      if (retries > 10) {
        return new Error("Redis reconnect limit reached");
      }
 
      return Math.min(retries * 100, 3000);
    },
  },
});
 
redis.on("error", (error) => {
  console.error("Redis error:", error.message);
});
 
redis.on("reconnecting", () => {
  console.warn("Redis reconnecting");
});
 
async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }
 
  const response = await redis.ping();
 
  if (response !== "PONG") {
    throw new Error("Redis PING failed");
  }
 
  console.log("Redis connected");
}
 
async function disconnectRedis() {
  if (redis.isOpen) {
    await redis.quit();
  }
}
 
module.exports = {
  redis,
  connectRedis,
  disconnectRedis,
};