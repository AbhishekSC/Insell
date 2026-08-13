import "dotenv/config";

const requiredKeys = ["MONGO_URI"];

export function validateEnv() {
  const missing = requiredKeys.filter((key) => !process.env[key]);
  return {
    ok: missing.length === 0,
    missing,
  };
}

export const env = {
  get nodeEnv() { return process.env.NODE_ENV || "development"; },
  get port() { return Number(process.env.PORT || 5001); },
  get mongoUri() { return process.env.MONGO_URI || ""; },
  get jwtSecret() { return process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || ""; },
};
