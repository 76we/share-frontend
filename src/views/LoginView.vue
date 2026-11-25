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
        <p class="card-welcome">{{ welcomeText }}</p>

        <!-- 表单区：登录=账号+密码；注册=账号+邮箱+密码+验证码；找回密码=邮箱+新密码+验证码 -->
        <div class="form-area">
          <el-input
            v-if="view !== 'reset'"
            v-model="form.username"
            placeholder="账号"
            clearable
          />
          <el-input
            v-if="view !== 'login'"
            v-model="form.email"
            placeholder="QQ 邮箱"
            clearable
          />
          <el-input
            v-model="form.password"
            type="password"
            :placeholder="view === 'reset' ? '新密码' : '密码'"
            show-password
          />
          <div v-if="view !== 'login'" class="code-row">
            <el-input
              v-model="form.emailCode"
              placeholder="邮箱验证码"
              maxlength="6"
            />
            <el-button
              class="code-btn"
              :loading="codeLoading"
              :disabled="countdown > 0"
              @click="sendCode"
            >
              {{ countdown > 0 ? countdown + 's' : '获取验证码' }}
            </el-button>
          </div>
          <p v-if="view === 'login'" class="forgot-link" @click="toReset">
            忘记密码？
          </p>
          <!-- 提交按钮：登录 → /users/login，注册 → /users/register，找回密码 → /users/reset-password -->
          <el-button
            class="submit-btn"
            :loading="loading"
            @click="handleSubmit"
          >
            {{ submitText }}
          </el-button>
        </div>

        <!-- 登录 / 注册 切换；找回密码时单独返回登录 -->
        <p class="switch-link" @click="toggleView">
          {{ switchText }}
        </p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
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
// 'login' 登录 | 'register' 注册 | 'reset' 找回密码
const view = ref('login')

const welcomeText = computed(() => ({
  login: '欢迎归来，尘间过客',
  register: '且在此处，叙你的故事',
  reset: '忘川有渡，重叙此门',
}[view.value]))

const submitText = computed(() => ({
  login: '登 录',
  register: '注 册',
  reset: '重置密码',
}[view.value]))

const switchText = computed(() => ({
  login: '没有账号？前往注册',
  register: '已有账号？返回登录',
  reset: '想起密码了？返回登录',
}[view.value]))

// 表单数据
const form = reactive({
  username: '',
  password: '',
  email: '',
  emailCode: '',
})

// 请求中标志，防止连点
const loading = ref(false)

/* ---------------- 邮箱验证码 ---------------- */
const codeLoading = ref(false)
const countdown = ref(0)
let countdownTimer = null

async function sendCode() {
  const email = form.email.trim()
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    ElMessage.warning('请先填写正确的邮箱')
    return
  }
  codeLoading.value = true
  try {
    // 找回密码走单独的验证码接口（scene=reset），注册走 register
    const url = view.value === 'reset' ? '/users/password-code' : '/users/email-code'
    const res = await axios.post(url, { email })
    // data=true 表示邮件已真发；false 表示后端没配发件邮箱，验证码只打到后端日志
    if (res.data.data) {
      ElMessage.success('验证码已发送，请查收邮箱（5 分钟内有效）')
    } else {
      ElMessage.warning('未配置发件邮箱，验证码已输出到后端日志，请查看控制台')
    }
    // 60 秒重发冷却
    countdown.value = 60
    clearInterval(countdownTimer)
    countdownTimer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) clearInterval(countdownTimer)
    }, 1000)
  } catch (err) {
    // 响应拦截器已统一提示
  } finally {
    codeLoading.value = false
  }
}

// 离开页面时清掉倒计时定时器，避免重复触发
onUnmounted(() => clearInterval(countdownTimer))

/* ---------------- 标语诗句轮播（打字机） ---------------- */
// 逐字写出 → 停留 → 抹去 → 换下一句，循环展示洒脱诗句
const { typed: typedSlogan } = useVerseTyper()

/* ---------------- 切换登录 / 注册 / 找回密码 ---------------- */
function resetForm() {
  form.username = ''
  form.password = ''
  form.email = ''
  form.emailCode = ''
}

function toggleView() {
  view.value = view.value === 'login' ? 'register' : 'login'
  resetForm()
}

// 登录页「忘记密码？」→ 找回密码
function toReset() {
  view.value = 'reset'
  resetForm()
}

/* ---------------- 提交表单 ---------------- */
async function handleSubmit() {
  if (view.value === 'reset') {
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      ElMessage.warning('请输入注册时用的邮箱')
      return
    }
    if (!/^\d{6}$/.test(form.emailCode.trim())) {
      ElMessage.warning('请输入 6 位邮箱验证码')
      return
    }
    if (form.password.length < 6) {
      ElMessage.warning('新密码至少 6 位')
      return
    }
    loading.value = true
    try {
      await axios.post('/users/reset-password', {
        email: form.email.trim(),
        code: form.emailCode.trim(),
        newPassword: form.password,
      })
      ElMessage.success('密码已重置，请用新密码登录')
      view.value = 'login'
      resetForm()
    } catch (err) {
      // 响应拦截器已统一提示
    } finally {
      loading.value = false
    }
    return
  }

  if (!form.username.trim() || !form.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  if (view.value === 'register') {
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      ElMessage.warning('请输入正确的邮箱')
      return
    }
    if (!/^\d{6}$/.test(form.emailCode.trim())) {
      ElMessage.warning('请输入 6 位邮箱验证码')
      return
    }
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
        email: form.email.trim(),
        emailCode: form.emailCode.trim(),
      })
      ElMessage.success('注册成功，请登录')
      view.value = 'login'
      form.password = ''
      form.email = ''
      form.emailCode = ''
      form.username = form.username.trim()
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
  /* iOS Safari 的 100vh 取的是「地址栏收起后」的高度，比实际可视区高，
     首屏底部的「向下探索」会被压到屏幕外，页面看起来像一张点不动的海报。
     svh 取小视口高度，两端都留 100vh 兜底。 */
  height: 100vh;
  height: 100svh;
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

/* ---------- 登录：忘记密码 ---------- */
.forgot-link {
  margin: -4px 0 0;
  text-align: right;
  font-size: 12px;
  letter-spacing: 1px;
  color: rgba(143, 211, 199, 0.62);
  cursor: pointer;
  transition: color 0.3s;
}
.forgot-link:hover {
  color: #8fd3c7;
}

/* ---------- 注册：邮箱验证码行 ---------- */
.code-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.code-row .el-input {
  flex: 1;
  min-width: 0;
}
.code-btn {
  flex-shrink: 0;
  height: 40px;
  padding: 0 16px;
  font-size: 13px;
  letter-spacing: 2px;
  background: transparent;
  border: 1px solid rgba(143, 211, 199, 0.4);
  color: #8fd3c7;
  transition: border-color 0.3s, color 0.3s, background 0.3s;
}
.code-btn:hover,
.code-btn:focus {
  background: rgba(143, 211, 199, 0.08);
  border-color: rgba(143, 211, 199, 0.85);
  color: #cdf1ea;
}
.code-btn.is-disabled,
.code-btn.is-disabled:hover {
  background: transparent;
  border-color: rgba(143, 211, 199, 0.18);
  color: rgba(143, 211, 199, 0.45);
  cursor: not-allowed;
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
