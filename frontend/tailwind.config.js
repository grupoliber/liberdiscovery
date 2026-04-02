/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#e6e8f0',
          100: '#c1c5d6',
          200: '#9ba2ba',
          300: '#757f9e',
          400: '#586489',
          500: '#3b4a74',
          600: '#33416a',
          700: '#29355d',
          800: '#1f2a51',
          900: '#101838',
          950: '#0a0f24',
        },
        accent: {
          green: '#0f9d58',
          red: '#e74c3c',
          orange: '#f39c12',
          blue: '#3498db',
          purple: '#9b59b6',
        },
      },
    },
  },
  plugins: [],
}
