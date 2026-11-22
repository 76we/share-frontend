// vite.config.js —— 放在项目根目录：share-frontend/vite.config.js
// Vite 构建配置：注册 Vue 插件，开发服务器默认端口 5173
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 按项目结构，Vite 默认以项目根目录为 base，无需额外配置
export default defineConfig({
  plugins: [vue()],
})
