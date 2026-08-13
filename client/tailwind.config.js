import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        light: {
          primary: "#2f6fed",
          secondary: "#14b8a6",
          accent: "#f59e0b",
          neutral: "#1f2937",
          "base-100": "#f8fafc",
          "base-200": "#eef2ff",
          "base-300": "#dbe4ff",
          info: "#0ea5e9",
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#ef4444",
        },
      },
      {
        dark: {
          primary: "#6aa3ff",
          secondary: "#2dd4bf",
          accent: "#fbbf24",
          neutral: "#0f172a",
          "base-100": "#0b1220",
          "base-200": "#0f172a",
          "base-300": "#1e293b",
          info: "#38bdf8",
          success: "#4ade80",
          warning: "#fbbf24",
          error: "#fb7185",
        },
      },
    ],
  },
};
