/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0d1117',
          card: '#161b22',
          raised: '#1c2128',
          border: '#30363d',
        },
        brand: {
          green: '#3fb950',
          red: '#f85149',
          yellow: '#d29922',
          blue: '#58a6ff',
          purple: '#bc8cff',
          cyan: '#39d353',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
