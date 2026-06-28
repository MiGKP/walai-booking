import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FEFDFB',
          100: '#FDFCF7',
          200: '#FAF6EC',
          300: '#F5EDD9',
          400: '#EDE0C0',
          500: '#E2CFA3',
        },
        forest: {
          50: '#E8F0ED',
          100: '#C5D9D1',
          200: '#9EBFB3',
          300: '#769F90',
          400: '#568775',
          500: '#366F5A',
          600: '#2A5A48',
          700: '#1E4A3B',
          800: '#123C30',
          900: '#0A2B21',
          950: '#051A14',
        },
        lagoon: {
          50: '#ECF4F5',
          100: '#D0E4E6',
          200: '#ADD1D4',
          300: '#88BCC0',
          400: '#6BAAAF',
          500: '#4E878C',
          600: '#437578',
          700: '#375F62',
          800: '#2C4D4F',
          900: '#1E3537',
        },
        bamboo: {
          50: '#FDF5E8',
          100: '#FAE7C5',
          200: '#F2D49B',
          300: '#E8BE6F',
          400: '#D9A05B',
          500: '#C48A3F',
          600: '#A87132',
          700: '#885A27',
          800: '#6B461E',
          900: '#4E3316',
        },
        charcoal: {
          DEFAULT: '#2B2D2F',
          50: '#F2F2F3',
          100: '#E5E5E6',
          200: '#CBCBCD',
          300: '#A3A5A7',
          400: '#76787A',
          500: '#55575A',
          600: '#43454A',
          700: '#35373B',
          800: '#2B2D2F',
          900: '#1A1B1D',
        },
      },
      fontFamily: {
        display: ['Pridi', 'serif'],
        body: ['Sarabun', 'sans-serif'],
        sans: ['Sarabun', 'sans-serif'],
      },
      keyframes: {
        revealUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        revealFade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scrollDot: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '50%': { opacity: '0.4', transform: 'translateY(8px)' },
          '100%': { opacity: '0', transform: 'translateY(14px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        heroLine: {
          '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
          '100%': { transform: 'scaleX(1)', transformOrigin: 'left' },
        },
      },
      animation: {
        'reveal-up': 'revealUp 500ms cubic-bezier(0.25, 1, 0.5, 1) both',
        'reveal-fade': 'revealFade 400ms cubic-bezier(0.25, 1, 0.5, 1) both',
        'scroll-dot': 'scrollDot 1.5s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 3s ease-in-out infinite',
        'hero-line': 'heroLine 600ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
export default config
