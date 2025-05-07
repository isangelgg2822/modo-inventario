/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./app/**/*.{js,ts,jsx,tsx}",
      "./pages/**/*.{js,ts,jsx,tsx}",
      "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          'corporate-dark-green': '#1A3C34',
          'corporate-light-green': '#2E5E54',
          'corporate-hover-green': '#3A7A6E',
          'input-bg': '#F1F5F9',
        },
      },
    },
    plugins: [],
  };