/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: {
          50: '#fdfcfa',
          100: '#faf8f4',
          200: '#f2ede5',
          300: '#e8e0d4',
        },
        ink: {
          900: '#1a1916',
          800: '#2d2b26',
          700: '#45423b',
          600: '#5c5850',
          500: '#757068',
        },
        accent: {
          DEFAULT: '#b8860b',
          light: '#d4a84b',
          dark: '#8b6914',
        },
      },
      boxShadow: {
        'soft': '0 4px 24px -4px rgba(26, 25, 22, 0.08), 0 8px 16px -6px rgba(26, 25, 22, 0.04)',
        'soft-lg': '0 12px 40px -8px rgba(26, 25, 22, 0.12), 0 4px 16px -4px rgba(26, 25, 22, 0.06)',
      },
    },
  },
  plugins: [],
}
