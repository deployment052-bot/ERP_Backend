import dotenv from "dotenv";
dotenv.config();

import { Sequelize } from "sequelize";

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  protocol: "postgres",
  logging: false,
  timezone: '+00:00',           
  
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },                       
    useUTC: true,             
  },
});

export default sequelize;