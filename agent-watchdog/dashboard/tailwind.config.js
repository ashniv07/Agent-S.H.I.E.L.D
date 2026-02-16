/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        severity: {
          low: '#22c55e',
          medium: '#eab308',
          high: '#f97316',
          critical: '#ef4444',
        },
        decision: {
          approve: '#22c55e',
          flag: '#eab308',
          kill: '#ef4444',
        },
      },
    },
  },
  plugins: [],
};
