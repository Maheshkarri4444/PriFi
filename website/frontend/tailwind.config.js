/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        noir: {
          950: "#06060a",
          900: "#0d0d14",
          800: "#12121c",
          700: "#1a1a28",
          600: "#22223a",
        },
        prifi: {
          400: "#7effdb",
          500: "#4dffc8",
          600: "#00e5a0",
          700: "#00b87d",
        },
        crimson: {
          400: "#ff6b8a",
          500: "#ff3d68",
        },
      },
      fontFamily: {
        display: ["'Space Mono'", "monospace"],
        body: ["'DM Sans'", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px #4dffc820, 0 0 20px #4dffc810" },
          "100%": { boxShadow: "0 0 20px #4dffc840, 0 0 60px #4dffc820" },
        },
      },
    },
  },
  plugins: [],
};