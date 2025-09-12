import express from "express";
import morgan from "morgan";
import "dotenv/config";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import { logger } from "./utils/logger.js";
import { connectToMongoDB } from "./config/db.config.js";
import { connectQueue, consumeFromQueue } from "./config/queue.config.js";

const app = express();
const PORT = process.env.PORT || 3001;

// **Middlewares**
app.use(express.json());
app.use(cookieParser());
app.use(
  morgan("combined", {
    stream: logger.stream,
  })
);

// **Routes**
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

// **Database connection and server initialization**
async function startServer() {
  try {
    connectToMongoDB();

    app.listen(PORT, async () => {
      await connectQueue();
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
