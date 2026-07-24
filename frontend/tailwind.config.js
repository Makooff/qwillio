/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Qwillio brand — #7a5fff primary, #7349fe deep, #cd6afb violet
        primary: {
          50: '#f4f0ff',
          100: '#e9e2ff',
          200: '#d3c6ff',
          300: '#b9a8ff',
          400: '#9d8bff',
          500: '#7a5fff',
          600: '#7349fe',
          700: '#5b2ee0',
          800: '#4720b0',
          900: '#2e1478',
        },
        violet: {
          300: '#e7bafd',
          400: '#dd93fc',
          500: '#cd6afb',
          600: '#b845f0',
          700: '#9526dd',
        },
      },
    },
  },
  plugins: [],
};
