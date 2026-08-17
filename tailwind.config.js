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
        background: '#07090d',
        surface: '#0d1117',
        'surface-elevated': '#121821',
        border: '#242d3a',
        accent: '#ff6a3d',
        'accent-dim': '#d64c23',
        'accent-red': '#ff4d6d',
        muted: '#9aa6b5',
      },
    },
  },
  plugins: [],
};
