import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blue: {
          50: "#effaf7",
          100: "#d9f1ea",
          200: "#b9e4d7",
          300: "#88cfb8",
          400: "#57b997",
          500: "#2b9e7a",
          600: "#1e8a68",
          700: "#16684f",
          800: "#0f4f3d",
          900: "#0c3e31",
        },
        sky: {
          50: "#effaf7",
          100: "#d9f1ea",
          200: "#b9e4d7",
          300: "#88cfb8",
          400: "#57b997",
          500: "#2b9e7a",
          600: "#1e8a68",
          700: "#16684f",
          800: "#0f4f3d",
          900: "#0c3e31",
        },
        brand: {
          50: "#effaf7",
          100: "#d9f1ea",
          200: "#b9e4d7",
          300: "#88cfb8",
          400: "#57b997",
          500: "#2b9e7a",
          600: "#1e8a68",
          700: "#16684f",
          800: "#0f4f3d",
          900: "#0c3e31",
        },
        ink: {
          50: "#f6f8fc",
          100: "#e8edf6",
          200: "#d3dbe8",
          300: "#b3bfd3",
          400: "#8b97ac",
          500: "#667085",
          600: "#4b5565",
          700: "#333c4e",
          800: "#232b3e",
          900: "#172031",
        },
      },
      boxShadow: {
        auth: "0 20px 45px rgba(15, 23, 42, 0.08)",
        button: "0 16px 30px rgba(31, 157, 122, 0.28)",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        sm: "0.25rem",
        md: "0.25rem",
        lg: "0.25rem",
        xl: "0.25rem",
        "2xl": "0.25rem",
        "3xl": "0.25rem",
        auth: "0.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
