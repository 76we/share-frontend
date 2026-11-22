<!-- src/views/LoginView.vue —— 登录 / 注册页（尘叙阁·暗色玄幻风）
     对接 POST /users/login、POST /users/register，登录成功后 token 存 localStorage 并跳 /home -->
<template>
  <div class="login-page">
    <!-- ① 首屏 Hero：占满一屏，品牌大字 + 诗句轮播 + 向下探索提示 -->
    <section class="hero" ref="heroSection">
      <!-- 首屏视频背景：森林丁达尔绿光（B站「奇迹-创造者」Wallpaper Engine 素材）；
           静态图（App.vue 全局背景）在视频加载前/失败时兜底 -->
      <div class="hero-video-wrap" aria-hidden="true">
        <video ref="heroVideo" class="hero-video" autoplay loop muted playsinline preload="metadata">
          <source src="/forest-tyndall.mp4" type="video/mp4" />
        </video>
        <div class="hero-video-mask"></div>
      </div>

      <h1 class="hero-title flow-text">尘叙阁</h1>
      <p class="hero-en">CHEN XU PAVILION</p>
      <div class="hero-divider"></div>
      <p class="hero-slogan">{{ typedSlogan }}<span class="type-cursor"></span></p>

      <!-- 向下探索：点击平滑滚动到下方登录卡片 -->
      <div class="scroll-hint" @click="scrollToCard">
        <span class="scroll-text">向下探索</span>
        <span class="scroll-arrow">⌄</span>
      </div>
    </section>

    <!-- ② 登录 / 注册卡片区 -->
    <section class="card-section" ref="cardSection">
      <div class="stage-card">
        <!-- 卡片内小标题 -->
        <h2 class="card-title">尘叙阁</h2>
        <p class="card-welcome">
          {{ view === 'login' ? '欢迎归来，尘间过客' : '且在此处，叙你的故事' }}
        </p>

        <!-- 表单区：登录 / 注册 共用同一组输入框 -->
        <div class="form-area">
          <el-input
            v-model="form.username"
            placeholder="账号"
            clearable
          />
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            show-password
          />
          <!-- 提交按钮：登录 → /users/login，注册 → /users/register -->
          <el-button
            class="submit-btn"
            :loading="loading"
            @click="handleSubmit"
          >
            {{ view === 'login' ? '登 录' : '注 册' }}
          </el-button>
        </div>

        <!-- 登录 / 注册 切换 -->
        <p class="switch-link" @click="toggleView">
          {{ view === 'login' ? '没有账号？前往注册' : '已有账号？返回登录' }}
        </p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { useVerseTyper } from '../utils/useVerseTyper'

const router = useRouter()

/* ---------------- 首屏视频：滚出视口暂停解码，回到视口恢复 ----------------
   视频仅 8.7MB，首屏用 preload="metadata" 避免一次性下载；
   滚动到登录卡片区后暂停，保证下方表单滚动零解码开销。 */
const heroVideo = ref(null)
const heroSection = ref(null)
let heroObserver = null
onMounted(() => {
  const heroEl = heroSection.value
  const v = heroVideo.value
  if (heroEl && 'IntersectionObserver' in window) {
    heroObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v?.play().catch(() => {})
        else v?.pause()
      },
      // 登录页较短，滚到卡片区时首屏仍有一部分留在视口内；
      // 把观察带压到视口下 40%，首屏大半滚出即暂停，避免观察器误判为仍可见
      { threshold: 0, rootMargin: '-60% 0px 0px 0px' }
    )
    heroObserver.observe(heroEl)
  }
})
onBeforeUnmount(() => {
  heroObserver?.disconnect()
  heroObserver = null
})

/* ---------------- 向下探索：滚动到登录卡片 ---------------- */
const cardSection = ref(null)
function scrollToCard() {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  cardSection.value?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

/* ---------------- 页面状态 ---------------- */
// 'login' 登录 | 'register' 注册
const view = ref('login')

// 表单数据
const form = reactive({
  username: '',
  password: '',
})

// 请求中标志，防止连点
const loading = ref(false)

/* ---------------- 标语诗句轮播（打字机） ---------------- */
// 逐字写出 → 停留 → 抹去 → 换下一句，循环展示洒脱诗句
const { typed: typedSlogan } = useVerseTyper()

/* ---------------- 切换登录 / 注册 ---------------- */
function toggleView() {
  view.value = view.value === 'login' ? 'register' : 'login'
  form.username = ''
  form.password = ''
}

/* ---------------- 提交表单 ---------------- */
async function handleSubmit() {
  if (!form.username.trim() || !form.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }

  loading.value = true
  try {
    if (view.value === 'login') {
      // ---------- 登录：POST /users/login ----------
      // data 即 JWT token 字符串，存入 localStorage，
      // main.js 的请求拦截器会自动带上 Authorization + token 两个请求头
      const res = await axios.post('/users/login', {
        username: form.username,
        password: form.password,
      })
      localStorage.setItem('token', res.data.data)
      localStorage.setItem('username', form.username.trim())
      ElMessage.success('欢迎归来，尘间再叙')
      // 跳转首页
      router.push('/home')
    } else {
      // ---------- 注册：POST /users/register ----------
      await axios.post('/users/register', {
        username: form.username,
        password: form.password,
      })
      ElMessage.success('注册成功，请登录')
      view.value = 'login'
    }
  } catch (err) {
    // 错误提示已由 main.js 的响应拦截器统一弹出（BusinessException 的 message），
    // 这里只吞掉异常，避免重复弹窗
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ================= 向下探索两段式登录页 ================= */
.login-page {
  position: relative;
  z-index: 1;
}

/* ---------- 首屏 Hero：满屏品牌展示 ---------- */
.hero {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  position: relative;
  overflow: hidden;
}
/* ---------- 首屏视频层：与首页同源，静态图兜底 ---------- */
.hero-video-wrap {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}
.hero-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 森林丁达尔素材保留绿光色调，只压暗 + 轻微降饱和，避免白字不可读 */
  filter: brightness(0.42) saturate(0.85);
  transform: translateZ(0);
}
.hero-video-mask {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 75% 65% at 50% 48%, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.8) 100%),
    linear-gradient(to bottom, rgba(10, 10, 10, 0.25) 0%, transparent 25%, transparent 70%, #0a0a0a 100%);
}
/* 视频层之上：前景文字提升层级 */
.hero-title,
.hero-en,
.hero-divider,
.hero-slogan {
  position: relative;
  z-index: 1;
}
.hero-title {
  font-family: var(--font-brush);
  font-size: clamp(56px, 10vw, 110px);
  font-weight: 400;
  letter-spacing: 0.12em;
  line-height: 1.1;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.8);
  /* 渐变文字流动由全局 .flow-text 提供，这里叠加淡入 */
  animation: fadeInUp 1.4s ease-out both, textFlow 5s linear infinite;
}
.hero-en {
  margin-top: 12px;
  font-size: clamp(11px, 1.6vw, 15px);
  letter-spacing: 0.6em;
  text-indent: 0.6em;
  color: rgba(255, 255, 255, 0.5);
  animation: fadeInUp 1.4s 0.2s ease-out both;
}
.hero-divider {
  width: 1px;
  height: 56px;
  margin: 28px 0;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(255, 255, 255, 0.5),
    transparent
  );
  animation: fadeInUp 1.4s 0.35s ease-out both;
}
.hero-slogan {
  font-size: clamp(15px, 2vw, 19px);
  color: rgba(255, 255, 255, 0.78);
  letter-spacing: 0.35em;
  min-height: 1.6em; /* 轮播擦除到空时保持高度 */
  animation: fadeInUp 1.4s 0.5s ease-out both;
}

/* ---------- 向下探索提示 ---------- */
.scroll-hint {
  position: absolute;
  z-index: 1;
  bottom: 42px;
  left: 0;
  right: 0;
  margin: 0 auto;
  width: fit-content;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.55);
  transition: color 0.3s;
  animation: fadeInUp 1.4s 0.8s ease-out both;
}
.scroll-hint:hover {
  color: rgba(255, 255, 255, 0.92);
}
.scroll-text {
  font-size: 13px;
  letter-spacing: 0.3em;
}
.scroll-arrow {
  font-size: 22px;
  line-height: 1;
  animation: arrowBounce 2s ease-in-out infinite;
}
@keyframes arrowBounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(8px); }
}

/* ---------- 登录卡片区（向下滚动到达） ---------- */
.card-section {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  padding: 24px 16px 96px;
}
.card-title {
  font-family: var(--font-brush);
  font-size: 34px;
  font-weight: 400;
  letter-spacing: 6px;
  color: #f5f5f5;
}
.card-welcome {
  margin-top: 8px;
  font-size: 12px;
  letter-spacing: 4px;
  color: rgba(255, 255, 255, 0.42);
}

/* ---------- 尊重系统的减少动态效果偏好 ---------- */
@media (prefers-reduced-motion: reduce) {
  .hero-title,
  .hero-en,
  .hero-divider,
  .hero-slogan,
  .scroll-hint,
  .scroll-arrow {
    animation: none !important;
  }
}
</style>
