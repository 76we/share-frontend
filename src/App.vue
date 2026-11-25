<!-- src/App.vue —— 根组件：统一顶部导航栏（毛玻璃黑底）+ 路由出口 -->
<template>
  <div class="app-shell">
    <!-- 全局静态背景（最底层）：水墨山水静态图 + 灰度模糊压暗。
         静态图滤镜只合成一次、不随滚动重算，替代原全屏视频以消除滚动卡顿。
         首页首屏自己的视频入场动画见 Home.vue，滚动离开后即暂停淡出。 -->
    <div class="static-bg" aria-hidden="true">
      <div class="static-bg-img"></div>
      <div class="static-bg-mask"></div>
    </div>

    <!-- 顶部固定导航栏（登录页隐藏，保持全屏居中卡片；首页首屏透明沉浸） -->
    <header v-if="!isLogin" class="navbar">
      <div class="nav-inner">
        <!-- 左：阁楼标志 + 毛笔字 Logo -->
        <router-link to="/home" class="nav-logo">
          <PavilionMark class="logo-mark" />
          <span class="logo-text">
            <span class="logo-brush">尘叙阁</span>
            <span class="logo-sub">CHEN XU PAVILION</span>
          </span>
        </router-link>

        <!-- 中右：导航 -->
        <nav class="nav-links">
          <router-link to="/home" class="nav-item">首页</router-link>
          <router-link to="/publish" class="nav-item">发布</router-link>
          <router-link to="/photowall" class="nav-item">照片墙</router-link>
          <router-link v-if="token" to="/profile" class="nav-item">个人中心</router-link>
        </nav>

        <!-- 右：用户信息 -->
        <div class="nav-user">
          <template v-if="token">
            <!-- 通知铃铛：未读角标 + 下拉列表 -->
            <el-popover placement="bottom-end" :width="340" trigger="click" popper-class="notif-popper" @show="openPanel">
              <template #reference>
                <button class="bell-btn" aria-label="通知">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
                    <path d="M10 21h4" />
                  </svg>
                  <span v-if="unread > 0" class="bell-badge">{{ unread > 99 ? '99+' : unread }}</span>
                </button>
              </template>
              <div class="notif-panel">
                <div class="notif-head">
                  <span>消息通知</span>
                  <button v-if="unread > 0" class="notif-readall" @click="readAll">全部已读</button>
                </div>
                <div v-if="notifLoading" class="notif-empty">加载中…</div>
                <div v-else-if="notifs.length === 0" class="notif-empty">暂无通知</div>
                <div v-else class="notif-list">
                  <div
                    v-for="n in notifs"
                    :key="n.id"
                    class="notif-item"
                    :class="{ unread: n.isRead === 0 }"
                    @click="openNotification(n)"
                  >
                    <span class="notif-avatar">
                      <img v-if="n.actorAvatar" :src="avatarUrl(n.actorAvatar)" alt="" />
                      <span v-else>{{ (n.actorName || '尘').charAt(0) }}</span>
                    </span>
                    <div class="notif-body">
                      <p class="notif-text"><b>{{ n.actorName || '有人' }}</b> {{ n.content }}</p>
                      <span class="notif-time">{{ timeAgo(n.createTime) }}</span>
                    </div>
                    <span v-if="n.isRead === 0" class="notif-dot"></span>
                  </div>
                </div>

                <!-- 待处理的好友申请（就地同意 / 拒绝 / 撤回） -->
                <template v-if="friendIncoming.length || friendSent.length">
                  <div class="friend-section">
                    <div class="friend-section-title">好友申请</div>

                    <div v-if="friendIncoming.length" class="friend-block">
                      <p class="friend-sub">收到的申请</p>
                      <div
                        v-for="f in friendIncoming"
                        :key="'in-' + f.id"
                        class="friend-row"
                      >
                        <span class="notif-avatar">
                          <img v-if="f.avatar" :src="avatarUrl(f.avatar)" alt="" />
                          <span v-else>{{ (f.nickname || f.username || '尘').charAt(0) }}</span>
                        </span>
                        <div class="friend-info">
                          <b class="friend-name">{{ f.nickname || f.username }}</b>
                          <span class="friend-name-sub">@{{ f.username }}</span>
                        </div>
                        <div class="friend-actions">
                          <button class="friend-accept" :disabled="f.processing === 1" @click="onAccept(f)">
                            {{ f.processing === 1 ? '…' : '同意' }}
                          </button>
                          <button class="friend-reject" :disabled="f.processing === 2" @click="onReject(f)">
                            {{ f.processing === 2 ? '…' : '拒绝' }}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div v-if="friendSent.length" class="friend-block">
                      <p class="friend-sub">我发出的申请</p>
                      <div
                        v-for="f in friendSent"
                        :key="'out-' + f.id"
                        class="friend-row"
                      >
                        <span class="notif-avatar">
                          <img v-if="f.avatar" :src="avatarUrl(f.avatar)" alt="" />
                          <span v-else>{{ (f.nickname || f.username || '尘').charAt(0) }}</span>
                        </span>
                        <div class="friend-info">
                          <b class="friend-name">{{ f.nickname || f.username }}</b>
                          <span class="friend-name-sub">已发出，等待对方同意</span>
                        </div>
                        <div class="friend-actions">
                          <button class="friend-reject" :disabled="f.processing === 2" @click="onCancelSent(f)">
                            {{ f.processing === 2 ? '…' : '撤回' }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </el-popover>

            <span class="user-chip">
              <span class="user-avatar">{{ avatarChar }}</span>
              <span class="nav-hello">{{ username || '尘间过客' }}</span>
            </span>
            <el-button class="nav-logout" size="small" @click="logout">退出</el-button>
          </template>
          <template v-else>
            <router-link to="/login" class="nav-login">登入尘叙阁</router-link>
          </template>
        </div>
      </div>
    </header>

    <!-- 路由出口（登录页、首页首屏不预留导航高度，让内容铺满视口） -->
    <main class="page-body" :class="{ 'no-nav': isLogin || isHome }">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PavilionMark from './components/PavilionMark.vue'
import {
  getNotifications, getUnreadCount, markNotificationRead, markAllRead,
} from './utils/notificationApi'
import {
  acceptFriend, rejectFriend,
  incomingRequests as fetchIncoming, sentRequests as fetchSent,
} from './utils/friendshipApi'

const route = useRoute()
const router = useRouter()

/* ---------------- 通知 ---------------- */
const unread = ref(0)
const notifs = ref([])
const notifLoading = ref(false)

function avatarUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  // 相对路径即可，由 vite proxy 的 /images 规则转发到后端
  return url.startsWith('/') ? url : '/' + url
}

function timeAgo(t) {
  if (!t) return ''
  const diff = (Date.now() - new Date(t).getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前'
  if (diff < 604800) return Math.floor(diff / 86400) + ' 天前'
  const d = new Date(t)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

async function loadUnread() {
  if (!localStorage.getItem('token')) { unread.value = 0; return }
  try { unread.value = Number(await getUnreadCount()) || 0 } catch (e) { /* 静默 */ }
}

async function loadNotifs() {
  if (!localStorage.getItem('token')) return
  notifLoading.value = true
  try {
    const data = await getNotifications(1, 20)
    notifs.value = data?.records || []
  } catch (e) { /* 拦截器已提示 */ }
  finally { notifLoading.value = false }
}

// 打开面板：同时刷新消息通知与好友申请两块
function openPanel() {
  loadNotifs()
  loadFriends()
}

async function openNotification(n) {
  if (n.isRead === 0) {
    try {
      await markNotificationRead(n.id)
      n.isRead = 1
      unread.value = Math.max(0, unread.value - 1)
    } catch (e) { /* 静默 */ }
  }
  // type 1/2 → 动态或照片，跳详情/墙；3/4 → 动态详情；5/6 → 好友申请，跳对方主页
  if (n.type === 2) router.push('/photowall')
  else if (n.type === 5 || n.type === 6) {
    if (n.actorId) router.push(`/profile/${n.actorId}`)
  } else if (n.targetId) router.push(`/detail/${n.targetId}`)
}

/* ---------------- 好友申请（就地同意 / 拒绝 / 撤回） ---------------- */
const friendIncoming = ref([])
const friendSent = ref([])

// 拉取收到的 / 发出的申请（纯待办列表，收到就常驻，处理后自动移除）
async function loadFriends() {
  if (!localStorage.getItem('token')) return
  try {
    const [inc, sent] = await Promise.all([fetchIncoming(), fetchSent()])
    friendIncoming.value = inc || []
    friendSent.value = sent || []
  } catch (e) { /* 静默 */ }
}

async function onAccept(f) {
  f.processing = 1
  try {
    await acceptFriend(f.id)
    friendIncoming.value = friendIncoming.value.filter((x) => x.id !== f.id)
  } catch (e) { /* 拦截器已提示 */ } finally { f.processing = 0 }
}

async function onReject(f) {
  f.processing = 2
  try {
    await rejectFriend(f.id)
    friendIncoming.value = friendIncoming.value.filter((x) => x.id !== f.id)
  } catch (e) { /* 拦截器已提示 */ } finally { f.processing = 0 }
}

async function onCancelSent(f) {
  f.processing = 2
  try {
    // 发出的申请"撤回"：后端 reject 会删除该记录（from_user=meId 的那条）
    await rejectFriend(f.id)
    friendSent.value = friendSent.value.filter((x) => x.id !== f.id)
  } catch (e) { /* 拦截器已提示 */ } finally { f.processing = 0 }
}

async function readAll() {
  try {
    await markAllRead()
    notifs.value.forEach((n) => { n.isRead = 1 })
    unread.value = 0
  } catch (e) { /* 拦截器已提示 */ }
}

/* ---------------- 滚动状态 ----------------
   首页已改为内容优先布局（顶部无 Hero），导航恒为毛玻璃胶囊，
   不再需要「滚动到顶部时切透明」的监听，滚动事件一并移除。 */
onMounted(() => {
  loadUnread()
})

// 登录页保持纯净（全屏居中卡片），不显示导航栏
const token = ref(localStorage.getItem('token') || '')
const username = ref(localStorage.getItem('username') || '')
const isLogin = computed(() => route.path === '/login')
const isHome = computed(() => route.path === '/home')

// 头像首字：用户名首字符（中文/英文均可），缺省为"尘"
const avatarChar = computed(() => {
  const name = (username.value || '').trim()
  return name ? name.charAt(0).toUpperCase() : '尘'
})

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  token.value = ''
  username.value = ''
  unread.value = 0
  notifs.value = []
  router.push('/login')
}

// 每次路由切换后刷新登录态（登录成功 / 登出）
watch(
  () => route.fullPath,
  () => {
    token.value = localStorage.getItem('token') || ''
    username.value = localStorage.getItem('username') || ''
    loadUnread()
  }
)
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 0;
}

/* ---------- 全局静态背景：水墨山水（零解码，滚动不卡顿） ----------
   滤镜（灰度/模糊/压暗）作用在静态图上，只合成一次、不随滚动重算。
   人物与书法字被模糊成水墨晕染，退为背景，不干扰前景内容阅读。 */
.static-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -2;
  overflow: hidden;
  background: #0a0a0a;
}
.static-bg-img {
  position: absolute;
  inset: 0;
  background-image: url('/cx-heal-lake.jpg');
  background-size: cover;
  background-position: center 46%;
  /* 灰度/模糊/压暗已烘焙进图片文件，运行时不施加任何 filter，
     避免全屏滤镜每帧合成（滚动卡顿主因之一） */
}
/* 遮罩：四周压暗 + 底部渐隐，保证文字可读、边缘柔和融入黑底 */
.static-bg-mask {
  position: absolute;
  inset: 0;
  /* 新背景图本身已是低对比暗调晨雾，遮罩只做轻压：四周略收、上下渐隐融进黑底 */
  background:
    radial-gradient(ellipse 90% 70% at 50% 45%, rgba(12, 16, 22, 0.06) 0%, rgba(6, 8, 12, 0.55) 100%),
    linear-gradient(to bottom, rgba(10, 12, 16, 0.28) 0%, transparent 30%, transparent 70%, rgba(10, 12, 16, 0.5) 100%);
}

/* ---------- 顶部导航：悬浮胶囊（古风毛玻璃试水层） ----------
   外层 navbar 只做定位与占位，视觉全部交给 .nav-inner 的胶囊体，
   胶囊四周透出背景壁纸，与参考站的悬浮导航观感一致。 */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: transparent;
  border: none;
  box-shadow: none;
  pointer-events: none;
}
/* 导航常驻：首页改为内容优先布局后不再有透明沉浸态，
   原 .nav-transparent 覆盖规则已移除。 */
.nav-inner {
  /* 与首页内容列（1040px）对齐：1040 + 左右各 26px 内边距 = 1092。
     这样胶囊体比内容列两侧各外扩 26px，logo 正好压在内容左边界上，
     既有「悬浮胶囊」的层次，也不会出现导航和正文各走各的错位。 */
  max-width: 1092px;
  margin: 10px auto 0;
  display: flex;
  align-items: center;
  gap: 40px;
  padding: 8px 26px;
  border-radius: 999px;
  /* 底色比周围壁纸亮一档：暗背景下毛玻璃无法靠"通透"显形，
     只能靠浅色胶囊体与黑底的明度差撑出轮廓。
     色相取暖墨（略偏棕），与首页的墨色玻璃卡片同一色系，避免冷蓝出戏 */
  background: linear-gradient(to bottom, rgba(38, 34, 29, 0.84), rgba(24, 21, 18, 0.78));
  backdrop-filter: blur(18px) saturate(130%);
  -webkit-backdrop-filter: blur(18px) saturate(130%);
  border: 1px solid rgba(222, 217, 203, 0.24);
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  pointer-events: auto;
  transition: background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease;
}

/* Logo：印章 + 毛笔字 */
.nav-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}
/* 阁楼标志：替代原方框「尘」字印章，无边框、可缩放 */
.logo-mark {
  font-size: 38px;
  color: var(--c-gold);
  filter: drop-shadow(0 0 8px rgba(232, 217, 181, 0.16));
  transition: color 0.3s ease, filter 0.3s ease;
}
.nav-logo:hover .logo-mark {
  color: #f4eeda;
  filter: drop-shadow(0 0 14px rgba(232, 217, 181, 0.5));
}
.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.logo-brush {
  font-family: var(--font-brush);
  font-size: 26px;
  letter-spacing: 5px;
  color: #f5f5f5;
}
.logo-sub {
  font-size: 8px;
  letter-spacing: 3px;
  color: var(--c-gold-dim);
  text-transform: uppercase;
  margin-top: 3px;
}

/* 导航链接：下划线从左滑入 */
.nav-links {
  display: flex;
  gap: 34px;
}
.nav-item {
  position: relative;
  font-size: 14px;
  letter-spacing: 3px;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  padding: 6px 2px;
  transition: color 0.25s ease;
}
.nav-item::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  height: 1px;
  width: 100%;
  background: var(--c-gold);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.nav-item:hover {
  color: rgba(255, 255, 255, 0.9);
}
.nav-item.router-link-active {
  color: var(--c-gold);
}
.nav-item:hover::after,
.nav-item.router-link-active::after {
  transform: scaleX(1);
}

/* 用户区 */
.nav-user {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

/* 通知铃铛 */
.bell-btn {
  position: relative;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  color: var(--c-gold-dim);
  background: transparent;
  border: 1px solid rgba(232, 217, 181, 0.22);
  border-radius: 50%;
  cursor: pointer;
  transition: color 0.25s ease, border-color 0.25s ease, background 0.25s ease;
}
.bell-btn svg { width: 18px; height: 18px; }
.bell-btn:hover {
  color: var(--c-gold);
  border-color: var(--c-gold-dim);
  background: rgba(232, 217, 181, 0.08);
}
.bell-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  display: grid;
  place-items: center;
  font-size: 10px;
  line-height: 1;
  color: #fff;
  background: #b4647a;
  border-radius: 999px;
  border: 1px solid rgba(14, 17, 22, 0.9);
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
}
/* 首字头像：淡金描边圆 */
.user-avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-family: var(--font-brush);
  font-size: 16px;
  color: var(--c-gold);
  background: rgba(232, 217, 181, 0.08);
  border: 1px solid var(--c-gold-dim);
}
.nav-hello {
  font-size: 13px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.72);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nav-logout {
  background: transparent;
  border: 1px solid rgba(232, 217, 181, 0.28);
  color: var(--c-gold-dim);
  letter-spacing: 2px;
  transition: background 0.25s ease, border-color 0.25s ease, color 0.25s ease;
}
.nav-logout:hover,
.nav-logout:focus {
  background: rgba(232, 217, 181, 0.08);
  border-color: var(--c-gold-dim);
  color: var(--c-gold);
}
.nav-login {
  font-size: 14px;
  letter-spacing: 3px;
  color: #f5f5f5;
  text-decoration: none;
  padding: 6px 16px;
  border: 1px solid var(--c-gold-dim);
  border-radius: 2px;
  transition: background 0.2s, border-color 0.2s;
}
.nav-login:hover {
  background: rgba(232, 217, 181, 0.08);
  border-color: var(--c-gold);
}

/* ---------------- 窄屏导航 ----------------
   原来没有任何移动端规则：胶囊内 logo 被挤成两行、四个链接竖着叠，
   整个导航塌成一团。这里只做「收缩 + 允许横滑」，不引入新交互。
   断点取 900 而不是 760：768px 的 iPad 竖屏按桌面规则走，四个链接
   会被压成一字一行（首／页、照／片／墙），必须一起收进来。 */
@media (max-width: 900px) {
  .nav-inner {
    margin: 8px 10px 0;
    gap: 10px;
    padding: 7px 10px;
    border-radius: 16px;
  }
  .nav-logo { flex: none; gap: 6px; min-height: 32px; align-items: center; }
  .logo-mark { font-size: 22px; }
  .logo-brush {
    font-size: 14px;
    letter-spacing: 2px;
    white-space: nowrap;
  }
  .logo-sub { display: none; }
  .nav-links {
    flex: 1 1 auto;
    min-width: 0;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .nav-links::-webkit-scrollbar { display: none; }
  .nav-item {
    flex: none;
    display: inline-flex;
    align-items: center;
    /* 原来只有 19px 高（11.5px 字 + 4px 上下内边距），远低于触屏
       24×24 的最小点按面积，手机上很难点中。这里撑到 30px。 */
    min-height: 30px;
    padding: 6px 3px;
    font-size: 11.5px;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }
  .nav-user { flex: none; gap: 7px; }
  .nav-hello { display: none; }
  .bell-btn { width: 30px; height: 30px; }
  .bell-btn svg { width: 16px; height: 16px; }
  .nav-logout { display: none; }
}

/* 超窄屏：只留印章标记、收起文字 logo。
   390px 下「尘叙阁」三个字要占 46px，正好把「个人中心」挤出胶囊。 */
@media (max-width: 480px) {
  .logo-text { display: none; }
  .logo-mark { font-size: 26px; }
}

/* 页面主体：为悬浮胶囊导航留出空间（胶囊 10px 上边距 + 约 56px 高） */
.page-body {
  flex: 1;
  padding-top: 82px;
}
.page-body.no-nav {
  padding-top: 0;
}
</style>

<!-- 通知面板：popover 被 teleport 到 body，用全局样式 -->
<style>
.notif-popper.el-popper {
  background: rgba(18, 21, 27, 0.97) !important;
  border: 1px solid rgba(232, 217, 181, 0.22) !important;
  border-radius: 8px !important;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6) !important;
  padding: 0 !important;
  color: #e8e4dc;
}
.notif-popper .el-popper__arrow::before {
  background: rgba(18, 21, 27, 0.97) !important;
  border-color: rgba(232, 217, 181, 0.22) !important;
}
.notif-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(232, 217, 181, 0.14);
  font-family: var(--font-brush);
  font-size: 15px;
  letter-spacing: 2px;
  color: var(--c-gold);
}
.notif-readall {
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--c-gold-dim);
  background: transparent;
  border: none;
  cursor: pointer;
}
.notif-readall:hover { color: var(--c-gold); }
.notif-empty {
  padding: 36px 16px;
  text-align: center;
  font-size: 13px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.4);
}
.notif-list { max-height: 360px; overflow-y: auto; }
.notif-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: background 0.2s ease;
}
.notif-item:hover { background: rgba(232, 217, 181, 0.06); }
.notif-item.unread { background: rgba(232, 217, 181, 0.04); }
.notif-avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  font-size: 14px;
  color: var(--c-gold);
  background: rgba(232, 217, 181, 0.1);
  border: 1px solid var(--c-gold-dim);
}
.notif-avatar img { width: 100%; height: 100%; object-fit: cover; }
.notif-body { flex: 1; min-width: 0; }
.notif-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notif-text b { color: var(--c-gold); font-weight: 500; }
.notif-time { font-size: 11px; color: rgba(255, 255, 255, 0.38); }
.notif-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #b4647a;
}

/* 好友申请区块 */
.friend-section {
  border-top: 1px solid rgba(232, 217, 181, 0.14);
}
.friend-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 6px;
  font-family: var(--font-brush);
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--c-gold);
}
.friend-sub {
  padding: 8px 16px 2px;
  font-size: 11px;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.4);
}
.friend-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
.friend-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.friend-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.friend-name-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.38);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.friend-actions {
  flex: none;
  display: flex;
  gap: 6px;
}
.friend-accept,
.friend-reject {
  font-size: 11px;
  letter-spacing: 1px;
  padding: 3px 10px;
  border-radius: 2px;
  cursor: pointer;
  background: transparent;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.friend-accept {
  color: var(--c-gold);
  border: 1px solid var(--c-gold-dim);
}
.friend-accept:hover:not(:disabled) {
  background: rgba(232, 217, 181, 0.1);
  border-color: var(--c-gold);
}
.friend-reject {
  color: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.16);
}
.friend-reject:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}
.friend-accept:disabled,
.friend-reject:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
