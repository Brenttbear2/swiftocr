// Vite 設定：開發伺服器與打包都讀這個檔案
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // 外掛：讓 Vite 看得懂 React（.tsx）與 Tailwind
  plugins: [react(), tailwindcss()],
  server: {
    // 開發時前端在 5173、後端在 8000；網址開頭是 /api 的請求轉給後端
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
});
