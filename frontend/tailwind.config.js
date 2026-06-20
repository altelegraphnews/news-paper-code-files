/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      zIndex: {
        'dropdown': '100',
        'sticky': '200',
        'navbar': '300',
        'overlay': '400',
        'modal': '500',
        'toast': '600',
      },
      colors: {
        // Midnight ink — the deep editorial base
        primary: {
          DEFAULT: '#1c2331',
          50: '#f1f3f7',
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
        // Gold foil
        accent: {
          DEFAULT: '#b8923d',
          50: '#fbf7ec',
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
        // Oxblood — urgent / breaking
        breaking: {
          DEFAULT: '#9e2b25',
          50: '#fdf3f2',
          100: '#fbe5e3',
          200: '#f8d0cc',
          300: '#f2afa9',
          400: '#e88078',
          500: '#da574d',
          600: '#c63a30',
          700: '#9e2b25',
          800: '#83271f',
          900: '#6e2622',
        },
        background: {
          DEFAULT: '#f6f1e6',
          dark: '#0c111a',
        },
        surface: {
          DEFAULT: '#fffcf5',
          dark: '#151c29',
        },
        ink: '#10151f',
        paper: '#f6f1e6',
      },
      fontFamily: {
        display: ['var(--font-aref-ruqaa)', 'serif'],
        heading: ['var(--font-amiri)', 'Georgia', 'serif'],
        body: ['var(--font-amiri)', 'Georgia', 'serif'],
        arabic: ['var(--font-plex-arabic)', 'Tahoma', 'sans-serif'],
        sans: ['var(--font-plex-arabic)', 'Tahoma', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.5' }],
        'sm': ['0.875rem', { lineHeight: '1.6' }],
        'base': ['1rem', { lineHeight: '1.8' }],
        'lg': ['1.125rem', { lineHeight: '1.8' }],
        'xl': ['1.25rem', { lineHeight: '1.75' }],
        '2xl': ['1.5rem', { lineHeight: '1.6' }],
        '3xl': ['1.875rem', { lineHeight: '1.5' }],
        '4xl': ['2.25rem', { lineHeight: '1.4' }],
        '5xl': ['3rem', { lineHeight: '1.3' }],
        '6xl': ['3.75rem', { lineHeight: '1.2' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 2px rgba(16, 21, 31, 0.05), 0 4px 16px rgba(16, 21, 31, 0.06)',
        'card-hover': '0 2px 4px rgba(16, 21, 31, 0.08), 0 16px 40px rgba(16, 21, 31, 0.14)',
        'nav': '0 2px 24px rgba(16, 21, 31, 0.18)',
        'gold': '0 4px 24px rgba(184, 146, 61, 0.35)',
      },
      animation: {
        'ticker': 'ticker 40s linear infinite',
        'fade-in': 'fadeIn 0.4s ease-in-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'rise': 'riseIn 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        riseIn: {
          '0%': { transform: 'translateY(28px)', opacity: '0', filter: 'blur(6px)' },
          '100%': { transform: 'translateY(0)', opacity: '1', filter: 'blur(0)' },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            direction: 'rtl',
            textAlign: 'right',
          },
        },
      },
    },
  },
  plugins: [],
};
