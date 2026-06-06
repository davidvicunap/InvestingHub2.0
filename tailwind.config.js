/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./docs/index.html', './docs/js/app.js'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81' },
        surface: { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',700:'#0f1729',800:'#0b1120',900:'#060a14' }
      }
    }
  },
  plugins: [],
}
