import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        soda: {
          50: '#eafaff',
          100: '#cdf1fb',
          400: '#6cd8ee',
          500: '#49cbeb',
          600: '#2ba9c9',
          700: '#1c7f9c',
        },
        surface: '#f4f5f6',
      },
      fontFamily: {
        sans: ['var(--font-sodapick)', 'sans-serif'],
      },
      maxWidth: {
        phone: '430px',
      },
    },
  },
  plugins: [],
};

export default config;
