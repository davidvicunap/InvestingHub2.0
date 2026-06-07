/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./docs/index.html', './docs/js/app.js'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a' },
        surface: { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',700:'#0f1729',800:'#0b1120',900:'#060a14' }
      }
    }
  },
  plugins: [],
}
