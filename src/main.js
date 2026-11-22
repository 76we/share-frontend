// src/main.js —— Vue 应用入口：创建实例、全局注册 Element Plus 与路由、配置 axios 拦截器

import { createApp } from 'vue'
import ElementPlus from 'element-plus'                    // element-plus 组件库
import 'element-plus/dist/index.css'                        // 组件库默认样式
import 'element-plus/theme-chalk/dark/css-vars.css'        // 暗色主题变量（配合 html class="dark"）
import { ElMessage } from 'element-plus'                    // 全局消息提示
import axios from 'axios'                                    // 请求库
import router from './router'                                // 路由配置
import App from './App.vue'
import './style.css'                                         // 全局样式（暗色玄幻风格变量、字体等）

// 暗色主题：Element Plus 需要 <html> 带 dark class（index.html 中已加）
document.documentElement.classList.add('dark')

// 后端统一地址（登录注册也用它）
axios.defaults.baseURL = 'http://localhost:8080'

// ① 全局注册 Element Plus + 路由
const app = createApp(App)
app.use(ElementPlus)
app.use(router)

// ② 请求拦截器：登录成功后 token 存在 localStorage，
//    每次发请求前自动带上 Authorization 请求头。
//    注意：评论的新增/删除接口（CommentController）用的是 @RequestHeader("token")，
//    所以同时设置 "Authorization" 与 "token" 两个请求头，缺一不可。
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = token
    config.headers.token = token
  }
  return config
})

// ③ 响应拦截器：捕获后端 BusinessException 的错误信息，用 ElMessage 弹出。
//    两条关键规则，避免"登录进去一堆请求失败"刷屏：
//    (a) silent 请求（点赞/收藏的 count、state 等可选查询）失败不弹提示，
//        组件里已有 initial 兜底，静默即可；
//    (b) 401 表示登录态失效：清掉失效 token，去重只弹一次并引导重新登录，
//        而不是每张卡片的 state 请求各弹一个错误。
let authErrorShown = false
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status

    // (a) 静默可选请求：不弹任何提示，直接交回调用方兜底
    if (err.config?.silent) {
      return Promise.reject(err)
    }

    // (b) 登录态失效：清 token、去重提示、跳登录
    if (status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      if (!authErrorShown) {
        authErrorShown = true
        ElMessage.error('登录已过期，请重新登录')
        setTimeout(() => { authErrorShown = false }, 2000)
        if (router.currentRoute.value.path !== '/login') {
          router.push('/login')
        }
      }
      return Promise.reject(err)
    }

    if (err.response) {
      // 后端有响应：优先取 BusinessException 的 message
      ElMessage.error(err.response.data?.message || err.response.data?.error || '请求失败，请稍后重试')
    } else {
      // 请求没有拿到任何 HTTP 响应：连接被拒 / 跨域被拦 / Mixed Content / 超时
      // 打印完整错误对象到控制台，便于一眼区分到底是哪种原因
      console.error('[请求失败-无响应]', {
        code: err.code,
        message: err.message,
        url: err.config?.url,
        baseURL: err.config?.baseURL,
      })
      const code = err.code || 'ERR_UNKNOWN'
      let tip = `请求未到达后端（${code}）`
      if (/Mixed Content/i.test(err.message || '')) {
        tip = '当前是 HTTPS 页面，浏览器拦截了对 http://localhost:8080 的请求（Mixed Content）。请用 http:// 打开页面。'
      } else if (code === 'ERR_NETWORK' && /CORS|cross-origin/i.test(err.message || '')) {
        tip = '跨域请求被浏览器拦截：请确认页面从 localhost:5173 打开，且后端 CORS 正常。'
      } else {
        tip += '：请确认 IDEA 后端 8080 已启动；若开着代理/VPN/加速器，请把 localhost 加入排除。详情见控制台。'
      }
      ElMessage.error(tip)
    }
    return Promise.reject(err)
  }
)

// ④ 挂载应用
app.mount('#app')
