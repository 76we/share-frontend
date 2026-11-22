<!-- src/views/LoginView.vue —— 登录 / 注册页（尘叙阁·水墨动态壁纸版）
     首屏背景用 InkBackdrop.vue（静态水墨图 + CSS 动效），不再依赖视频文件；
     对接 POST /users/login、POST /users/register，登录成功后 token 存 localStorage 并跳 /home -->
<template>
  <div class="login-page">
    <!-- ① 首屏 Hero：占满一屏，品牌大字 + 诗句轮播 + 向下探索提示 -->
    <section class="hero">
      <!-- 首屏动态壁纸：云海楼阁（静态图 212KB + CSS 四层动效，见 InkBackdrop.vue）。
           不再使用 forest-tyndall.mp4（B站壁纸素材，无可商用授权） -->
      <InkBackdrop class="hero-backdrop" src="/ink-pavilion.jpg" :dim="0.78" />

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
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import { useVerseTyper } from '../utils/useVerseTyper'
import InkBackdrop from '../components/InkBackdrop.vue'

const router = useRouter()

/* ---------------- 首屏动态壁纸 ----------------
   画面动效全部交给 InkBackdrop.vue 的 CSS（推镜 + 两层雾漂移 + 朱砂呼吸），
   不需要 JS 也不需要视频解码，滚动时零额外开销。
   想换画面只改 src，想换风格改组件里的图层参数即可。 */

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
/* ---------- 首屏动态壁纸层 ---------- */
.hero-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
}
/* 文字压罩：这张图右侧云海很亮，居中的白字会被吃掉，
   所以在画面中部单独加深一层椭圆遮罩，只压文字区域、不吃掉阁楼与云纹细节 */
.hero-backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  background: radial-gradient(
    ellipse 54% 48% at 50% 47%,
    rgba(0, 0, 0, 0.52) 0%,
    rgba(0, 0, 0, 0.34) 42%,
    rgba(0, 0, 0, 0.08) 68%,
    transparent 82%
  );
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
