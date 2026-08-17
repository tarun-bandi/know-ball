/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
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
        background: '#0b1017',
        surface: '#141b25',
        'surface-elevated': '#19232f',
        border: '#2a3747',
        accent: '#ff7048',
        'accent-dim': '#d64c23',
        'accent-red': '#ff4d6d',
        muted: '#aeb9c8',
      },
    },
  },
  plugins: [],
};
