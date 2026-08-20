import express from "express";
import axios from "axios";
import { logger } from "../utils/logger.js";

const router = express.Router();

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// City -> coordinates rarely changes, so cache indefinitely once resolved.
const geocodeCache = new Map();

// Current conditions change often but not minute-to-minute; short TTL keeps
// repeated page loads cheap without going stale.
const weatherCache = new Map();
const WEATHER_TTL_MS = 15 * 60 * 1000;

// WMO weather codes (https://open-meteo.com/en/docs) collapsed into a
// small set of human-readable conditions + emoji for the UI.
const WEATHER_CODE_MAP = {
  0: { condition: "Clear sky", icon: "☀️" },
  1: { condition: "Mostly clear", icon: "🌤️" },
  2: { condition: "Partly cloudy", icon: "⛅" },
  3: { condition: "Overcast", icon: "☁️" },
  45: { condition: "Foggy", icon: "🌫️" },
  48: { condition: "Foggy", icon: "🌫️" },
  51: { condition: "Light drizzle", icon: "🌦️" },
  53: { condition: "Drizzle", icon: "🌦️" },
  55: { condition: "Heavy drizzle", icon: "🌧️" },
  61: { condition: "Light rain", icon: "🌧️" },
  63: { condition: "Rain", icon: "🌧️" },
  65: { condition: "Heavy rain", icon: "🌧️" },
  71: { condition: "Light snow", icon: "🌨️" },
  73: { condition: "Snow", icon: "🌨️" },
  75: { condition: "Heavy snow", icon: "❄️" },
  80: { condition: "Rain showers", icon: "🌦️" },
  81: { condition: "Rain showers", icon: "🌦️" },
  82: { condition: "Violent showers", icon: "⛈️" },
  95: { condition: "Thunderstorm", icon: "⛈️" },
  96: { condition: "Thunderstorm", icon: "⛈️" },
  99: { condition: "Thunderstorm", icon: "⛈️" },
};

const describeWeatherCode = (code) => WEATHER_CODE_MAP[code] || { condition: "Unknown", icon: "🌡️" };

const geocodeCity = async (city) => {
  const key = city.toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  const response = await axios.get(GEOCODING_URL, {
    params: { name: city, count: 1, language: "en", format: "json" },
    timeout: 6000,
  });

  const result = response.data?.results?.[0];
  if (!result) return null;

  const coords = { latitude: result.latitude, longitude: result.longitude, resolvedName: result.name };
  geocodeCache.set(key, coords);
  return coords;
};

// GET /api/weather/current?city=Mumbai
router.get("/current", async (req, res) => {
  const city = (req.query.city || "").toString().trim();

  if (!city || city.toLowerCase() === "all") {
    return res.status(400).json({ success: false, message: "A specific city is required" });
  }

  const cacheKey = city.toLowerCase();
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < WEATHER_TTL_MS) {
    return res.json({ success: true, data: cached.data, cached: true });
  }

  try {
    const coords = await geocodeCity(city);
    if (!coords) {
      return res.status(404).json({ success: false, message: `Could not resolve location for "${city}"` });
    }

    const response = await axios.get(FORECAST_URL, {
      params: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
        timezone: "auto",
      },
      timeout: 6000,
    });

    const current = response.data?.current;
    if (!current) {
      return res.status(502).json({ success: false, message: "Weather data unavailable" });
    }

    const { condition, icon } = describeWeatherCode(current.weather_code);
    const data = {
      city: coords.resolvedName,
      temperatureC: Math.round(current.temperature_2m),
      condition,
      icon,
      humidity: current.relative_humidity_2m,
      windSpeedKmh: Math.round(current.wind_speed_10m),
      observedAt: current.time,
    };

    weatherCache.set(cacheKey, { timestamp: Date.now(), data });
    return res.json({ success: true, data, cached: false });
  } catch (error) {
    logger.warn("Weather lookup failed", { requestId: req.id, city, error: error.message });
    return res.status(502).json({ success: false, message: "Weather service unavailable" });
  }
});

export default router;
