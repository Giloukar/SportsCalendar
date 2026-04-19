/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tier: {
          s: '#D92D20',
          's-glow': '#F59E0B',
          a: '#F97316',
          b: '#2563EB',
          c: '#94A3B8',
        },
      },
      animation: {
        'pulse-live': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
