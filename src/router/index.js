// src/router/index.js —— 路由配置
// /login 登录注册、/home 首页信息流、/publish 发布图文、/detail/:id 动态详情
import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import Home from '../views/Home.vue'
import Publish from '../views/Publish.vue'
import Detail from '../views/Detail.vue'
import Profile from '../views/Profile.vue'
import PhotoWall from '../views/PhotoWall.vue'
import Topic from '../views/Topic.vue'

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

export default router
