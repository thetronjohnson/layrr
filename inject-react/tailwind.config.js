/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Use a prefix to avoid conflicts with host app styles
  prefix: 'vc-',
  // Use important to override host app styles when needed
  important: '#layrr-root',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#667eea',
          dark: '#764ba2',
        },
        danger: {
          DEFAULT: '#f5576c',
          dark: '#f093fb',
        },
      },
      zIndex: {
        'overlay': '999998',
        'modal': '999999',
      },
    },
  },
  plugins: [],
  // Disable preflight to avoid conflicts with host app
  corePlugins: {
    preflight: false,
  },
}
