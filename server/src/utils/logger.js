import winston from "winston";
import dailyRotateFile from "winston-daily-rotate-file";
import "dotenv/config";
import DailyRotateFile from "winston-daily-rotate-file";

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "error" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new dailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "4d",
    }),
    new DailyRotateFile({
      filename: "logs/conbined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "4d",
    }),
  ],
});

logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

export { logger };
