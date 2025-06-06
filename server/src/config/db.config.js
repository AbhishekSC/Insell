import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import "dotenv/config";

// **Configuration for MongoDB connection
const getMongoOptions = () => ({
  connectTimeoutMS: parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS, 10) || 30000,
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) || 10,
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 10000,
});

// **Setup event listeners for Mongoose connection
const setupEventListeners = () => {
  const db = mongoose.connection;
  db.on("connected", () => {
    logger.info("MongoDB connection established successfully");
  });
  db.on("disconnected", () => {
    logger.warn("MongoDB connection disconnected. Attempting to reconnect...");
  });
  db.on("error", (error) => {
    logger.error(`MongoDB connection error: ${error.message}`, {
      stack: error.stack,
    });
  });
  process.on("SIGINT", async () => {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed due to application termination");
    process.exit(0);
  });
};

// **Connect to MongoDB
const connectToMongoDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;
  const options = getMongoOptions();

  if (!MONGODB_URI) {
    logger.error("MongoDB URI is not defined in environment variables");
    throw new Error("MongoDB URI is not defined");
  }

  try {
    // Set mongoose options
    mongoose.set("strictQuery", false);
    mongoose.set("debug", process.env.NODE_ENV !== "produciton");

    // Connect to MongoDB
    const connectionInstance = await mongoose.connect(MONGODB_URI, options);

    logger.info(
      `MongoDB connected successfully! DB HOST: ${connectionInstance.connection.host}`
    );

    setupEventListeners();

    return connectionInstance;
  } catch (error) {
    logger.error("Failed to connect to MongoDB", {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

export { connectToMongoDB };
