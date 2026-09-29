/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          950: '#020817',
          900: '#04101f',
          850: '#061523',
          800: '#081b2e',
          700: '#0d2640',
          600: '#123556',
          accent: '#22d3ee',
          accent2: '#0ea5e9',
        },
        risk: {
          low: '#22c55e',
          medium: '#eab308',
          high: '#f97316',
          critical: '#ef4444',
        },
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(2, 8, 23, 0.55)',
      },
      backdropBlur: {
        xs: '2px',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
