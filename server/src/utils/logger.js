import winston from "winston";
import dailyRotateFile from "winston-daily-rotate-file";
import "dotenv/config";
import DailyRotateFile from "winston-daily-rotate-file";

// JSON.stringify throws on circular references (e.g. Axios/HTTP errors that
// carry raw ClientRequest/IncomingMessage objects). Replace repeats with a marker instead.
function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, val) => {
    if (typeof val === "object" && val !== null) {
      if (seen.has(val)) return "[Circular]";
      seen.add(val);
    }
    return val;
  });
}

// Custom format to include request ID if available
const requestIdFormat = winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
  const logObj = {
    timestamp,
    level,
    message,
    ...meta
  };
  
  if (requestId) {
    logObj.requestId = requestId;
  }
  
  return JSON.stringify(logObj);
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "error" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: "syncspace-backend" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
          const requestIdStr = requestId ? `[${requestId.substring(0, 8)}] ` : '';
          const metaStr = Object.keys(meta).length ? safeStringify(meta) : '';
          return `${timestamp} ${level}: ${requestIdStr}${message} ${metaStr}`.trim();
        })
      )
    }),
    new dailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "4d",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new DailyRotateFile({
      filename: "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "4d",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
  ],
});

logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

export { logger };
