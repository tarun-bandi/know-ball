/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        background: '#08080a',
        surface: '#141416',
        'surface-elevated': '#1c1c20',
        border: '#2a2a30',
        accent: '#d4a843',
        'accent-dim': '#b8922e',
        'accent-red': '#e63946',
        muted: '#7a7d88',
      },
    },
  },
  plugins: [],
};
