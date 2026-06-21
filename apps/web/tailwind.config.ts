import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identity = "money green", upgraded from a flat lime to a premium,
        // jewel-toned emerald. `brand` also carries the "profit/positive"
        // semantic across the driver app.
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        // Warm gold accent — premium highlights, plan/crown, subtle emphasis.
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f4b740',
          600: '#d99a1c',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // "Acceptable" status + soft informational surfaces.
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          900: '#78350f',
        },
        // "Not profitable" / destructive — refined rose-red.
        danger: {
          50: '#fff1f2',
          100: '#ffe4e6',
          300: '#fda4af',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
        },
        // Neutral surfaces & text — cool slate, professional and calm.
        road: {
          50: '#f6f8f9',
          100: '#eef1f3',
          200: '#e3e8ec',
          300: '#cbd4da',
          400: '#94a3b0',
          500: '#647585',
          600: '#475565',
          700: '#334150',
          800: '#1d2733',
          900: '#0d141c',
        },
      },
      borderRadius: {
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        // Soft, layered elevations tuned for a light, airy mobile UI.
        card: '0 1px 2px rgba(13,20,28,0.04), 0 8px 24px -12px rgba(13,20,28,0.12)',
        'card-lg':
          '0 2px 4px rgba(13,20,28,0.05), 0 20px 40px -20px rgba(13,20,28,0.18)',
        nav: '0 -1px 0 rgba(13,20,28,0.03), 0 8px 32px -8px rgba(13,20,28,0.18)',
        brand: '0 6px 16px -4px rgba(5,150,105,0.45)',
        'brand-lg': '0 12px 28px -8px rgba(5,150,105,0.5)',
      },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'brand-grad-soft': 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
        'gold-grad': 'linear-gradient(135deg, #fcd34d 0%, #f4b740 100%)',
        'app-bg':
          'radial-gradient(120% 70% at 50% -10%, #e3f5ec 0%, rgba(246,248,249,0) 55%), linear-gradient(180deg, #f6f8f9 0%, #f6f8f9 100%)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
