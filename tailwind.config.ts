import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}','./pages/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'vapor-bg': '#0b0c1a',
        'vapor-card': '#141527',
        'vapor-text': '#eaeafc',
        'vapor-subtext': '#a7a8c8',
        'vapor-pink': '#ff71ce',
        'vapor-cyan': '#01cdfe',
        'vapor-green': '#05ffa1',
        'vapor-purple': '#b967ff',
        'vapor-yellow': '#fffb96',
      },
    }
  },
  plugins: [],
} satisfies Config