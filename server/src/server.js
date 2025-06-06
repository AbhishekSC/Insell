import express from "express";
import "dotenv/config";
import morgan from "morgan";
import { logger } from "./utils/logger.js";
import { connectToMongoDB } from "./config/db.config.js";
import authRoutes from "./routes/auth.route.js";

const app = express();
const PORT = process.env.PORT || 3001;

// **Middlewares
app.use(
  morgan("combined", {
    stream: logger.stream,
  })
);

// **Routes
app.use("/api/auth", authRoutes);
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is healthy",
  });
});

// **Database connection and server initialization
async function startServer() {
  try {
    connectToMongoDB();

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`, {
      stack: error.stack,
    });
    process.exit(1); // Exit the process with failure
  }
}

// **Start the server
startServer();
