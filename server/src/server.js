import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import { logger } from "./utils/logger.js";
import { connectToMongoDB } from "./config/db.config.js";
import { connectQueue, consumeFromQueue } from "./config/queue.config.js";

const app = express();
const PORT = process.env.PORT || 5001;

// **Middlewares**
// const corsOptions = {
//   origin: "http://localhost:5173",
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// };

// // CORS must be before routes
// app.use(cors(corsOptions));
// // This handles preflight (OPTIONS) requests for all routes
// app.options("*", cors(corsOptions));

const corsOptions = {
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["Authorization"],
};

app.use(cors(corsOptions));

app.use(cors(corsOptions));

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
