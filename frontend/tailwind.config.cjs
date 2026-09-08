// tailwind.config.cjs
module.exports = {
  content: [
    "./src/**/*.{astro,js,ts,jsx,tsx}",
    "./src/components/**/*.{astro,js,ts,jsx,tsx}",
    "./components/**/*.{astro,js,ts,jsx,tsx}",
    "./src/styles/**/*.css"
  ],
  darkMode: ["selector", '[data-staff-theme="dark"]'],
  theme: { extend: {} },
  plugins: [],
  safelist: [{ pattern: /.*/ }],
};
