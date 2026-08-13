import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import "dotenv/config";

// **Configuration for MongoDB connection
const getMongoOptions = () => ({
  connectTimeoutMS: parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS || "30000", 10) || 30000,
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || "10", 10) || 10,
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
};

// Call during a coordinated shutdown (see server.js) — do not attach signal
// handlers here, since multiple independent SIGINT listeners racing to call
// process.exit() can cut off other resources' cleanup mid-flight.
async function closeMongoConnection() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
  logger.info("MongoDB connection closed");
}

// **Connect to MongoDB
const connectToMongoDB = async () => {
  const MONGODB_URI = process.env.MONGO_URI;
  const options = getMongoOptions();

  if (!MONGODB_URI) {
    logger.error("MongoDB URI is not defined in environment variables");
    throw new Error("MongoDB URI is not defined");
  }

  try {
    mongoose.set("strictQuery", false);
    mongoose.set("debug", process.env.NODE_ENV !== "production");

    // Connect to MongoDB
    const connectionInstance = await mongoose.connect(MONGODB_URI, options);

    logger.info(
      `MongoDB connected successfully! DB HOST: ${connectionInstance.connection.host}, DB NAME: ${connectionInstance.connection.name}`
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

export { connectToMongoDB, closeMongoConnection };
