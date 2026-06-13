/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#050507',
        surface: '#0D0D11',
        border: 'rgba(255,255,255,0.06)',
        accent: '#00E599',
        primary: '#FFFFFF',
        secondary: '#9A9A9E',
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
  plugins: [require('tailwindcss-animate')]
}

