import { createClient } from "redis";
import dotenv from "dotenv";
const client = createClient({
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
       
    }
});
client.on("error", (err) => {
  console.error(" Redis Error:", err);
});

await client.connect();

console.log(" Redis Connected");

export default client;