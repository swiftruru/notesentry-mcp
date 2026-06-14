/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // NoteSentry 醫療專業配色
        brand: {
          DEFAULT: '#0D5C63', // 主色
          secondary: '#247B7B', // 次色
          accent: '#E6B17E' // 點綴
        },
        card: {
          DEFAULT: '#EAF3F3', // 卡片底
          foreground: '#1C2B2D'
        },
        ink: {
          DEFAULT: '#1C2B2D', // 主文字
          muted: '#5A6B6D' // 次要文字
        },
        border: '#D4E4E4',
        ring: '#247B7B'
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem'
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang TC',
          'Microsoft JhengHei',
          'sans-serif'
        ]
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
