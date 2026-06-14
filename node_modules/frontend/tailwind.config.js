/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#18181b',
        card: '#27272a',
        muted: '#a1a1aa',
        border: '#3f3f46',
      },
    },
  },
  plugins: [],
}
