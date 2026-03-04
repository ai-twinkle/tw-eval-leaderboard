import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_PATH || '/tw-eval-leaderboard/',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.d.ts'],
  },
});
