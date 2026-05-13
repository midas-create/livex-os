import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        /** Dense UI — sidebar / labels */
        "2xs": ["0.6875rem", { lineHeight: "1.25", letterSpacing: "0.02em" }],
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground, white)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        livex: {
          navy: "#082441",
          "navy-muted": "#0c2340",
          orange: "#ea580c",
          "orange-hover": "#c2410c",
          surface: "#eef1f6",
          line: "rgba(15, 35, 60, 0.08)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        "livex-sm":
          "0 1px 2px rgba(8, 36, 65, 0.05), 0 1px 1px rgba(8, 36, 65, 0.04)",
        "livex-md":
          "0 2px 4px rgba(8, 36, 65, 0.06), 0 8px 20px rgba(8, 36, 65, 0.06)",
        "livex-card":
          "0 1px 0 rgba(8, 36, 65, 0.04), 0 4px 16px rgba(8, 36, 65, 0.06)",
        "livex-card-hover":
          "0 4px 8px rgba(8, 36, 65, 0.07), 0 16px 40px rgba(8, 36, 65, 0.1)",
        /** Carte catalogue — blanc pur, relief net au survol */
        "livex-catalog":
          "0 1px 0 rgba(8, 36, 65, 0.06), 0 2px 6px rgba(8, 36, 65, 0.06), 0 8px 20px rgba(8, 36, 65, 0.05)",
        "livex-catalog-hover":
          "0 4px 0 rgba(234, 88, 12, 0.12), 0 8px 16px rgba(8, 36, 65, 0.1), 0 20px 44px rgba(8, 36, 65, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
