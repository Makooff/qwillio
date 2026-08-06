/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Qwillio brand — #7a5fff primary, #7349fe deep, #cd6afb violet
        primary: {
          50: '#f4f0ff',
          100: '#e9e2ff',
          200: '#d3c6ff',
          300: '#b9a8ff',
          400: '#9d8bff',
          500: '#7a5fff',
          600: '#7349fe',
          700: '#5b2ee0',
          800: '#4720b0',
          900: '#2e1478',
        },
        violet: {
          300: '#e7bafd',
          400: '#dd93fc',
          500: '#cd6afb',
          600: '#b845f0',
          700: '#9526dd',
        },
        // Design V2 « Papier & Signal » — voir DA/v2-direction.md.
        // Clair: ElevenLabs (DA/references/elevenlabs.md). Drenched: Linear (DA/references/linear.md).
        q2: {
          // Surfaces et textes: pilotés par les variables de v2.css pour que le
          // thème sombre bascule d'un seul endroit. `<alpha-value>` préserve les
          // modificateurs d'opacité (bg-q2-plate/50), que `var(--x)` seul
          // casserait.
          canvas: 'rgb(var(--q2-canvas) / <alpha-value>)',
          band: 'rgb(var(--q2-band) / <alpha-value>)',
          plate: 'rgb(var(--q2-plate) / <alpha-value>)',
          ink: 'rgb(var(--q2-ink) / <alpha-value>)',
          graphite: 'rgb(var(--q2-graphite) / <alpha-value>)',
          body: 'rgb(var(--q2-body) / <alpha-value>)',
          faint: 'rgb(var(--q2-faint) / <alpha-value>)',
          // La marque et le registre drenched ne basculent pas: ils sont les
          // mêmes dans les deux thèmes.
          indigo: '#7A5FFF',
          violet: '#CD6BFB',
          deep: '#7349FE',
          lift: '#B9A8FF',
          void: '#08090A',
          carbon: '#0F1011',
          obsidian: '#161718',
          'graphite-d': '#23252A',
          'smoke-d': '#383B3F',
          mist: '#D0D6E0',
          fog: '#8A8F98',
        },
      },
      fontFamily: {
        outfit: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
