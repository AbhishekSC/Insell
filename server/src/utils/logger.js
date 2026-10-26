import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { Logtail } from "@logtail/node";
import { LogtailTransport } from "@logtail/winston";
import "dotenv/config";

const SPLAT = Symbol.for("splat");

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

// Clean and human-readable formatter for terminal / console logs
const consoleFormat = winston.format.printf((info) => {
  const { timestamp, level, message, requestId, stack, service, ...meta } = info;
  const splat = info[SPLAT] || [];

  let finalMessage = typeof message === "object" ? safeStringify(message) : String(message || "");

  // If there are un-interpolated trailing arguments (e.g. logger.warn("worker error:", err.message))
  const unhandledArgs = splat.filter((arg) => typeof arg !== "object" || arg instanceof Error);
  if (unhandledArgs.length > 0) {
    const extra = unhandledArgs.map((s) => (s instanceof Error ? s.message || s.stack : String(s))).join(" ");
    finalMessage = `${finalMessage} ${extra}`;
  }

  // Filter out redundant HTTP keys, service name, and numeric keys from console output
  const CONSOLE_OMIT_KEYS = new Set([
    "service",
    "requestId",
    "method",
    "url",
    "statusCode",
    "responseTime",
  ]);

  const cleanMeta = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!CONSOLE_OMIT_KEYS.has(k) && !/^\d+$/.test(k) && v !== undefined && v !== null) {
      cleanMeta[k] = v;
    }
  }

  const entries = Object.entries(cleanMeta);
  let metaStr = "";
  if (entries.length > 0) {
    const isSimple = entries.every(([, v]) => typeof v !== "object" || v === null);
    if (isSimple && entries.length <= 4) {
      metaStr = " \x1b[90m(" + entries.map(([k, v]) => `${k}: ${v}`).join(", ") + ")\x1b[0m";
    } else {
      metaStr = " \x1b[90m" + safeStringify(cleanMeta) + "\x1b[0m";
    }
  }

  const reqIdStr = requestId ? `\x1b[90m[${String(requestId).substring(0, 8)}]\x1b[0m ` : "";
  let line = `\x1b[90m${timestamp}\x1b[0m ${level}: ${reqIdStr}${finalMessage}${metaStr}`;
  if (stack && !finalMessage.includes(stack)) {
    line += `\n\x1b[90m${stack}\x1b[0m`;
  }
  return line;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat()
  ),
  defaultMeta: {
    service: "nearmyspace-backend",
    environment: process.env.NODE_ENV || "development",
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "HH:mm:ss" }),
        consoleFormat
      ),
    }),
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "4d",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
    new DailyRotateFile({
      filename: "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "4d",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
});

// Stream detailed structured logs to Better Stack Logtail when token is configured
if (process.env.LOGTAIL_SOURCE_TOKEN) {
  try {
    const options = {};
    if (process.env.LOGTAIL_INGESTING_HOST) {
      const host = process.env.LOGTAIL_INGESTING_HOST.trim();
      options.endpoint = host.startsWith("http") ? host : `https://${host}`;
    }
    const logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN, options);
    logger.add(new LogtailTransport(logtail));
  } catch (err) {
    console.error("Failed to initialize Logtail transport:", err);
  }
}

logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

export { logger };

