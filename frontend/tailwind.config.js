/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#eae8e1', // Main background
          light: '#f5f4f0',
          lighter: '#ffffff',
          dark: '#d5d3cc',
        },
        button: {
          DEFAULT: '#171717', // Button color
          hover: '#2a2a2a',
          active: '#0a0a0a',
        },
        border: {
          DEFAULT: '#c2c0bb', // Border color
        },
        slate: {
          850: '#1e293b',
          950: '#0f172a',
        }
      },
    },
  },
  plugins: [],
}
