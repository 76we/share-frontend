// src/router/index.js —— 路由配置
// /login 登录注册、/home 首页信息流、/publish 发布图文、/detail/:id 动态详情
import { createRouter, createWebHistory } from 'vue-router'

/* 路由组件一律走动态 import（懒加载）。
   静态 import 会把 7 个视图打成一个 chunk：打开登录页也要下载并解析
   PhotoWall(1523 行) / AlbumManager(823 行) 这些根本用不到、也看不到的代码，
   实测 index chunk 363kB(raw) / 122kB(gzip)，CSS 189kB 同样捆在一起。
   改成 () => import() 后 Rollup 按路由切 chunk，首屏只付当前页的成本，
   样式也会跟着各自的 chunk 拆开。
   注意：这里不要加 webpackChunkName 之类的注释，Vite 用文件路径自动命名。 */
const LoginView = () => import('../views/LoginView.vue')
const Home = () => import('../views/Home.vue')
const Publish = () => import('../views/Publish.vue')
const Detail = () => import('../views/Detail.vue')
const Profile = () => import('../views/Profile.vue')
const PhotoWall = () => import('../views/PhotoWall.vue')
const Topic = () => import('../views/Topic.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // 根路径：有 token 进 /home，无 token 进 /login
    {
      path: '/',
      redirect: () => (localStorage.getItem('token') ? '/home' : '/login'),
    },
    // 登录 / 注册
    { path: '/login', component: LoginView },
    // 首页信息流
    { path: '/home', component: Home },
    // 发布图文
    { path: '/publish', component: Publish },
    // 动态详情（含评论树）
    { path: '/detail/:id', component: Detail },
    // 话题详情
    { path: '/topic/:id', component: Topic },
    // 个人中心：不带参数为我的主页，带 userId 为 TA 的主页
    { path: '/profile', component: Profile },
    { path: '/profile/:userId', component: Profile },
    // 照片墙：不带参数为我的墙，带 userId 为访问 TA 的墙
    { path: '/photowall', component: PhotoWall },
    { path: '/photowall/:userId', component: PhotoWall },
  ],
})

// 全局前置守卫：无 token 只放行 /login，避免直接敲 /home 时白发一堆 401；
// 已有 token 访问 /login 直接回首页。
router.beforeEach((to) => {
  const hasToken = !!localStorage.getItem('token')
  if (!hasToken && to.path !== '/login') {
    const query = to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : {}
    return { path: '/login', query }
  }
  if (hasToken && to.path === '/login') {
    return { path: '/home' }
  }
  return true
})

// 懒加载的必备兜底：上线新版本后，旧的 chunk 文件会被删掉。
// 用户停留在旧页面（HTML 还是旧的）时点导航，动态 import 会 404，
// 报 "Failed to fetch dynamically imported module"，路由导航直接失败、页面卡住不动。
// 整页刷新一次就能拿到新入口。加 10s 防抖标记，避免 CDN 还在发旧 HTML 时无限刷新。
router.onError((err, to) => {
  const msg = String(err?.message || err)
  if (!/dynamically imported module|Loading chunk|Importing a module script/i.test(msg)) return
  if (sessionStorage.getItem('chunk-reload') === '1') return
  sessionStorage.setItem('chunk-reload', '1')
  setTimeout(() => sessionStorage.removeItem('chunk-reload'), 10000)
  window.location.assign(to?.fullPath || '/')
})

export default router
