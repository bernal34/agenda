/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#534AB7',
          light: '#EEEDFE',
          mid: '#AFA9EC',
          dark: '#3C3489',
        },
      },
    },
  },
  plugins: [],
};
