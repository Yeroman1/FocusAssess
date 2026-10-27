import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0f172a',
          container: '#131b2e',
          fixed: '#dae2fd',
          dim: '#bec6e0',
        },
        secondary: {
          DEFAULT: '#4b41e1',
          container: '#645efb',
          fixed: '#e2dfff',
        },
        surface: {
          DEFAULT: '#f8f9ff',
          dim: '#cbdbf5',
          bright: '#f8f9ff',
          container: '#e5eeff',
          'container-low': '#eff4ff',
          'container-lowest': '#ffffff',
          'container-high': '#dce9ff',
          'container-highest': '#d3e4fe',
          variant: '#d3e4fe',
        },
        'on-surface': '#0b1c30',
        'on-surface-variant': '#45464d',
        'on-primary': '#ffffff',
        'on-secondary': '#ffffff',
        'on-tertiary-container': '#069669',
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
          'on-container': '#93000a',
        },
        outline: '#76777d',
        'outline-variant': '#c6c6cd',
        'dark-ide': {
          DEFAULT: '#0b0f19',
          header: '#131b2e',
          footer: '#0f172a',
          accent: '#38bdf8',
        },
      },
      fontFamily: {
        sans: ['Geist', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
