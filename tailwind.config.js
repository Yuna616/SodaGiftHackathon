/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 스폰서 콘솔 색상
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        // 참가자 앱 색상 — 스타일 레퍼런스 기반 스카이블루 + 블랙 팔레트
        // (해커톤 중 확정한 디자인, docs/SodaPick_유저앱_PRD.md 톤 참고)
        soda: {
          50: "#eafaff",
          100: "#cdf1fb",
          400: "#6cd8ee",
          500: "#49cbeb",
          600: "#2ba9c9",
          700: "#1c7f9c",
        },
        // 리디자인 시안(claude.ai/design) 색상 — 참가자 앱 전용
        ink: "#14161A",
        accent: {
          light: "#E6F8FD",
          DEFAULT: "#17C1E8",
          dark: "#0A8FB0",
        },
        danger: "#E0453C",
        success: "#12A150",
        warning: "#C96A00",
      },
      fontFamily: {
        sodapick: ["var(--font-sodapick)", "Pretendard", "system-ui", "sans-serif"],
        logo: ["var(--font-logo)", "Pacifico", "cursive"],
      },
    },
  },
  plugins: [],
};
