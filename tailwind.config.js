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
        background: '#0b1118',
        surface: '#111923',
        'surface-elevated': '#172231',
        border: '#2f4052',
        accent: '#4ea1ff',
        'accent-dim': '#2f7fd4',
        'accent-red': '#ff6b76',
        muted: '#8fa1b3',
      },
    },
  },
  plugins: [],
};
