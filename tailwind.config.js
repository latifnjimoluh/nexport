/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0e1116",
        "bg-soft": "#161b22",
        "bg-row": "#1c2230",
        border: "#2a3142",
        accent: "#4f8cff",
        danger: "#e5484d",
        warn: "#f5a524",
        ok: "#3ecf8e",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "JetBrains Mono",
          "Cascadia Code",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
