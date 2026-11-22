// vite.config.js —— 放在项目根目录：share-frontend/vite.config.js
// Vite 构建配置：注册 Vue 插件，开发服务器固定 5173，
// 并通过 proxy 把后端请求转发到 Spring Boot（默认 8080）。
//
// 这样前端代码里不再写死 http://localhost:8080：
//   axios.baseURL = '/api'  →  转发到 http://localhost:8080/<去掉 /api 的路径>
//   图片 /images/**         →  转发到 http://localhost:8080/images/**
// 后端换端口/上线时，只改这里的 target 即可。
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 后端地址（改端口只改这一行）
const BACKEND = 'http://localhost:8080'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // 接口：/api/moments/list → http://localhost:8080/moments/list
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // 图片资源：后端 WebConfig 里映射的 /images/** → file:D:/uploads/
      '/images': {
        target: BACKEND,
        changeOrigin: true,
      },
    },
  },
  build: {
    // 首屏包 1.2MB 偏大（主要是 Element Plus 全量引入），生产打包时按依赖拆包，
    // 让 Vue / Element Plus 各自成为可长期缓存的独立 chunk
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router'],
          'element-plus': ['element-plus'],
          axios: ['axios'],
        },
      },
    },
  },
})
