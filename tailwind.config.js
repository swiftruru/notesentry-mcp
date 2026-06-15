/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // NoteSentry 醫療專業配色（以 CSS 變數驅動，支援 light/dark 切換，見 index.css）
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)', // 主色
          secondary: 'rgb(var(--brand-secondary) / <alpha-value>)', // 次色
          accent: 'rgb(var(--brand-accent) / <alpha-value>)' // 點綴
        },
        // 面板/卡片表面（取代直接用 bg-white）
        surface: 'rgb(var(--surface) / <alpha-value>)',
        // App 整體背景
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)', // 卡片底
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)'
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)', // 主文字
          muted: 'rgb(var(--ink-muted) / <alpha-value>)' // 次要文字
        },
        border: 'rgb(var(--border) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)'
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
