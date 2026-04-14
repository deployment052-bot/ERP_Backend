import express from "express";
import dotenv from "dotenv";
import sequelize from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import hierarchyRoutes from "./routes/hierarchyRoutes.js";
import ledgerRoutes from "./routes/ledgerRoutes.js";
import storeRoutes from "./routes/storeRoutes.js";
import districtRoutes from "./routes/districtRoutes.js"; 
import userRoutes from "./routes/userRoutes.js";
import goldRoutes from "./routes/goldRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import sheetRoutes from "./routes/sheet.routes.js";
import reportRoutes from "./routes/reportRoutes.js";
import swaggerSpec from "./config/swagger.js";
import customerRoutes from "./routes/customerRoutes.js";
import swaggerUi from "swagger-ui-express";
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//  Routes
app.use("/api/auth", authRoutes);
app.use("/api/hierarchy", hierarchyRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/districts", districtRoutes); 
app.use("/api/users", userRoutes);
app.use("/api/gold", goldRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api", sheetRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/customers", customerRoutes);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("DB Connected");

    await sequelize.sync();
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
      console.log("Swagger URL: http://localhost:5000/api-docs");
    });
  } catch (error) {
    console.error("Error:", error);
  }
};

startServer();