/** @type {import('tailwindcss').Config} */

// التلغراف — "Golden Telegraph" design system (mirrors frontend/tailwind.config.js)
// Ink & parchment editorial aesthetic with gold-foil accents.

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'Tahoma', 'sans-serif'],
        heading: ['Amiri', 'Georgia', 'serif'],
        display: ['"Aref Ruqaa"', 'serif'],
        arabic: ['"IBM Plex Sans Arabic"', 'Tahoma', 'sans-serif'],
        content: ['Amiri', 'Georgia', 'serif'],
      },
      colors: {
        // Warm editorial neutrals: parchment at the light end, midnight ink at the dark end.
        // Light steps (50–300) are paper/border tones; dark steps (700–950) are ink surfaces.
        gray: {
          50:  '#faf6ec',
          100: '#f0ead9',
          200: '#e3dac6',
          300: '#cfc5ab',
          400: '#7b8294',
          500: '#646b7e',
          600: '#4c5263',
          700: '#2a3447',
          800: '#151c29',
          900: '#10151f',
          950: '#0a0e16',
        },
        // Oxblood — danger & the classic newspaper red
        red: {
          50:  '#fdf3f2',
          100: '#fbe5e3',
          200: '#f8d0cc',
          300: '#f2afa9',
          400: '#e88078',
          500: '#da574d',
          600: '#c63a30',
          700: '#9e2b25',
          800: '#83271f',
          900: '#6e2622',
          950: '#54201c',
        },
        // Gold foil — the brand accent
        gold: {
          DEFAULT: '#b8923d',
          50:  '#fbf7ec',
          100: '#f5ebcf',
          200: '#ead5a0',
          300: '#dcba6a',
          400: '#cfa549',
          500: '#b8923d',
          600: '#9c7630',
          700: '#7d5b29',
          800: '#684a27',
          900: '#593f25',
          950: '#332112',
        },
        // Midnight ink — the deep editorial base
        ink: {
          DEFAULT: '#1c2331',
          50:  '#f1f3f7',
          100: '#dde2ea',
          200: '#bcc5d4',
          300: '#94a3ba',
          400: '#6e809d',
          500: '#536582',
          600: '#42506a',
          700: '#364156',
          800: '#2a3344',
          900: '#1c2331',
          950: '#10151f',
        },
        brand: {
          gold: '#b8923d',
          ink:  '#1c2331',
          paper:'#f6f1e6',
        },
        surface: {
          DEFAULT: '#fffcf5',
          dark:    '#151c29',
          muted:   '#efe8d8',
          'muted-dark': '#1d2636',
        },
        background: {
          DEFAULT: '#f6f1e6',
          dark: '#0c111a',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 21, 31, 0.05), 0 4px 16px rgba(16, 21, 31, 0.06)',
        'card-hover': '0 2px 4px rgba(16, 21, 31, 0.08), 0 16px 40px rgba(16, 21, 31, 0.14)',
        nav: '0 2px 24px rgba(16, 21, 31, 0.18)',
        gold: '0 4px 24px rgba(184, 146, 61, 0.35)',
      },
      screens: {
        'xs': '475px',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-in-out',
        'slide-in':   'slideIn 0.2s ease-in-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'rise':       'riseIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%':   { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        riseIn: {
          '0%':   { transform: 'translateY(18px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
