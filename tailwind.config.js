/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tailwind CSSが適用されるファイルを指定
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // srcフォルダ内のすべてのJS/JSX/TS/TSXファイル
    "./public/index.html", // publicフォルダのindex.html
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
