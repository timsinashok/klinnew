/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "monospace",
        ],
      },
      fontSize: {
        // pharma-grade compact scale
        "2xs": ["0.6875rem", { lineHeight: "1rem" }], // 11px
      },
      colors: {
        accent: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        sev: {
          critical: {
            50: "#fff1f2",
            100: "#ffe4e6",
            300: "#fda4af",
            500: "#f43f5e",
            600: "#e11d48",
            700: "#be123c",
            800: "#9f1239",
          },
          warning: {
            50: "#fffbeb",
            100: "#fef3c7",
            300: "#fcd34d",
            500: "#f59e0b",
            600: "#d97706",
            700: "#b45309",
            800: "#92400e",
          },
          suggested: {
            50: "#f0f9ff",
            100: "#e0f2fe",
            300: "#7dd3fc",
            500: "#0ea5e9",
            600: "#0284c7",
            700: "#0369a1",
            800: "#075985",
          },
        },
      },
      boxShadow: {
        panel:
          "0 1px 0 0 rgba(15,23,42,0.04), 0 1px 2px 0 rgba(15,23,42,0.04)",
      },
    },
  },
  plugins: [],
};
