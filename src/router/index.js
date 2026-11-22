// src/router/index.js —— 路由配置
// /login 登录注册、/home 首页信息流、/publish 发布图文、/detail/:id 动态详情
import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import Home from '../views/Home.vue'
import Publish from '../views/Publish.vue'
import Detail from '../views/Detail.vue'
import Profile from '../views/Profile.vue'
import PhotoWall from '../views/PhotoWall.vue'

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
    // 个人中心
    { path: '/profile', component: Profile },
    // 照片墙：不带参数为我的墙，带 userId 为访问 TA 的墙
    { path: '/photowall', component: PhotoWall },
    { path: '/photowall/:userId', component: PhotoWall },
  ],
})

export default router
