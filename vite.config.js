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
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// 后端地址（改端口只改这一行）
const BACKEND = 'http://localhost:8080'

export default defineConfig({
  plugins: [
    vue(),
    // Element Plus 按需：模板里的 <el-button> 与脚本里的 ElMessage/ElMessageBox
    // 都自动 import，顺带只带对应组件的 css。
    // 全站实际只用到 9 个组件，整包引入要多背 ~1.4MB。
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: false,
    }),
    Components({
      resolvers: [ElementPlusResolver({ directives: true })],
      dts: false,
    }),
  ],
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
    // 注意：manualChunks 里不要再写 'element-plus': ['element-plus']，
    // 那等于强行把整包拉进来，按需引入会被完全抵消（实测 JS 仍 946kB）。
    // 拆包交给 rollup 按实际引用自动分。
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router'],
          axios: ['axios'],
        },
      },
    },
  },
})
