/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        marquee: {
          '0%, 15%':   { transform: 'translateX(0px)' },
          '85%, 100%': { transform: 'translateX(-120px)' },
        },
      },
      animation: {
        marquee: 'marquee 4s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
}
