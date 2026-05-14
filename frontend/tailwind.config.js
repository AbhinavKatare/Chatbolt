/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        surface: '#111111',
        border: 'rgba(255,255,255,0.07)',
        accent: '#B8FF00',
        primary: '#FFFFFF',
        secondary: '#888888',
      },
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        body: ['var(--font-dm-sans)', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'input': '8px',
      },
    }
  },
  plugins: []
}

