<!-- src/views/PhotoWall.vue —— 我的照片墙：动态带图自动汇入，拍立得网格 + 灯箱，可切换"那年今日" -->
<template>
  <div class="wall-page">
    <!-- 页头 -->
    <header class="wall-header">
      <div class="wall-title-row">
        <svg class="wall-camera" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.1-1.7a1.5 1.5 0 0 1 1.25-.7h4.9a1.5 1.5 0 0 1 1.25.7L17.8 6h1.7A2.5 2.5 0 0 1 22 8.5v9A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5v-9Z" />
          <circle cx="12" cy="13" r="3.6" />
        </svg>
        <h1 class="wall-title">{{ isOther ? 'TA 的照片墙' : '照片墙' }}</h1>
      </div>
      <p class="wall-subtitle">{{ isOther ? '隔着光影，读一段别人的时光' : '以光影，留住尘世间的每一个瞬间' }}</p>
      <span class="wall-rule"></span>
    </header>

    <!-- 未登录引导 -->
    <div v-if="!logged" class="wall-state">
      <p class="wall-empty-text">登入尘叙阁，翻开属于你的光影集</p>
      <router-link to="/login" class="wall-login-btn">前往登录</router-link>
    </div>

    <template v-else>
      <!-- 私密墙提示（访问 TA 的私密墙，或加载出错） -->
      <div v-if="denied" class="wall-state">
        <p class="wall-empty-text">🔒 {{ denied }}</p>
        <button class="wall-login-btn" @click="goMyWall">看看我的照片墙</button>
      </div>

      <template v-else>
      <!-- tab 切换：我的墙 / 那年今日（仅自己的墙显示） -->
      <div v-if="!isOther" class="wall-tabs">
        <button
          class="wall-tab"
          :class="{ active: mode === 'mine' }"
          @click="switchMode('mine')"
        >我的照片墙</button>
        <button
          class="wall-tab"
          :class="{ active: mode === 'anniversary' }"
          @click="switchMode('anniversary')"
        >那年今日</button>
        <button
          class="wall-tab"
          :class="{ active: mode === 'year' }"
          @click="switchMode('year')"
        >年度回忆</button>
        <button
          class="wall-tab"
          :class="{ active: mode === 'albums' }"
          @click="switchMode('albums')"
        >我的相册</button>
      </div>

      <!-- 年度回忆：年份选择 -->
      <div v-if="!isOther && mode === 'year'" class="year-picker">
        <span class="year-picker-label">选择年份</span>
        <button
          v-for="y in availableYears"
          :key="y"
          class="year-chip"
          :class="{ active: selectedYear === y }"
          @click="selectYear(y)"
        >{{ y }}</button>
      </div>

      <!-- 我的相册：照片墙的手动整理层 -->
      <AlbumManager v-if="mode === 'albums'" />

      <!-- 可见性开关（仅自己的墙显示） -->
      <div v-if="!isOther && mode === 'mine'" class="visibility-row">
        <span class="visibility-label">谁可以看我的照片墙</span>
        <button
          class="visibility-toggle"
          :class="{ public: visibility === 1 }"
          @click="toggleVisibility"
          :disabled="visibilitySaving"
        >
          <span class="visibility-dot"></span>
          {{ visibilitySaving ? '保存中…' : (visibility === 1 ? '公开 · 他人可访问' : '私密 · 仅自己可见') }}
        </button>
      </div>

      <template v-if="mode !== 'albums'">
      <!-- 加载中（首页） -->
      <div v-if="loading && groups.length === 0" class="wall-state">
        <span class="wall-spinner"></span>
        <p>正在铺展相册…</p>
      </div>

      <!-- 空状态 -->
      <div v-else-if="groups.length === 0" class="wall-state">
        <p class="wall-empty-text">{{ emptyHint }}</p>
        <router-link v-if="mode === 'mine'" to="/publish" class="wall-login-btn">去发布</router-link>
      </div>

      <template v-else>
        <!-- 月份导航 -->
        <nav class="month-nav">
          <button
            v-for="g in groups"
            :key="monthKey(g)"
            class="month-nav-item"
            @click="scrollToMonth(g)"
          >
            {{ navLabel(g) }}<span class="month-nav-count">{{ g.count }}</span>
          </button>
        </nav>

        <!-- 月份区间 -->
        <section v-for="g in groups" :key="monthKey(g)" :id="'month-' + monthKey(g)" class="month-section">
          <header class="month-head">
            <span class="month-year">{{ g.year || '——' }}</span>
            <span class="month-name">{{ g.month ? monthZh(g.month) + '月' : g.label }}</span>
            <span class="month-dot">·</span>
            <span class="month-count">{{ g.count }} 张留影</span>
            <span class="month-rule"></span>
          </header>

          <div class="polaroid-grid">
            <div
              v-for="(photo, i) in g.photos"
              :key="photo.id"
              class="polaroid"
              :style="polaroidStyle(photo, i)"
              @click="openLightbox(globalIndexOf(g, i))"
            >
              <span class="tape"></span>
              <div class="polaroid-frame">
                <div class="polaroid-img landscape">
                  <img :src="imgUrl(photo.url)" :alt="photo.caption || '照片'" loading="lazy" />
                </div>
              </div>
              <span v-if="photo.caption" class="polaroid-caption">{{ photo.caption }}</span>
              <span v-if="photo.yearsAgo" class="years-badge">{{ photo.yearsAgo }} 年前</span>
              <!-- 点赞按钮：targetType=3 照片，阻止冒泡避免触发灯箱 -->
              <span class="polaroid-like" @click.stop>
                <LikeButton :target-id="photo.id" :target-type="3" :initial="photo.likeCount || 0" />
              </span>
            </div>
          </div>
        </section>

        <p class="wall-end">— 已至卷末 —</p>
      </template>
      </template>
      </template>
    </template>

    <!-- 灯箱 -->
    <transition name="lb-fade">
      <div v-if="lightboxOpen" class="lightbox" @click="closeLightbox">
        <div class="lb-backdrop"></div>
        <button class="lb-close" @click.stop="closeLightbox" aria-label="关闭">×</button>
        <button
          v-if="photos.length > 1"
          class="lb-nav lb-prev"
          @click.stop="prevPhoto"
          aria-label="上一张"
        >‹</button>
        <transition name="lb-slide" mode="out-in">
          <div class="lb-stage" :key="photos[lightboxIndex]?.id" @click.stop>
            <img :src="imgUrl(photos[lightboxIndex]?.url)" :alt="photos[lightboxIndex]?.caption || '照片'" />
            <p v-if="photos[lightboxIndex]?.caption" class="lb-caption">{{ photos[lightboxIndex].caption }}</p>
            <p v-if="mode === 'anniversary' && photos[lightboxIndex]?.yearsAgo" class="lb-years">
              {{ photos[lightboxIndex].yearsAgo }} 年前的今天
            </p>
            <div class="lb-like" @click.stop>
              <LikeButton
                v-if="photos[lightboxIndex]"
                :target-id="photos[lightboxIndex].id"
                :target-type="3"
                :initial="photos[lightboxIndex].likeCount || 0"
              />
            </div>
          </div>
        </transition>
        <button
          v-if="photos.length > 1"
          class="lb-nav lb-next"
          @click.stop="nextPhoto"
          aria-label="下一张"
        >›</button>
        <div class="lb-counter">{{ lightboxIndex + 1 }} / {{ photos.length }}</div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getMyPhotosGrouped, getAnniversaryPhotosGrouped, getOtherPhotosGrouped,
  getYearPhotosGrouped, getPhotoWallVisibility, setPhotoWallVisibility,
} from '../utils/photoWallApi'
import LikeButton from '../components/LikeButton.vue'
import AlbumManager from '../components/AlbumManager.vue'

const route = useRoute()
const router = useRouter()

const logged = ref(!!localStorage.getItem('token'))
const mode = ref('mine')                 // mine | anniversary | year | albums
const groups = ref([])                   // 按月分区：[{ year, month, label, count, photos }]

// 年度回忆：当前年往前 6 年可选
const currentYear = new Date().getFullYear()
const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - i)
const selectedYear = ref(currentYear)

const emptyHint = computed(() => ({
  anniversary: '往年今日，尚无留影',
  year: `${selectedYear.value} 年，尚未留下光影`,
  albums: '还没有相册',
}[mode.value] || '还没有照片，发一条带图动态吧'))
const loading = ref(false)
const denied = ref('')                   // 访问他人私密墙时的提示

const visibility = ref(0)                // 0私密 1公开
const visibilitySaving = ref(false)

const lightboxOpen = ref(false)
const lightboxIndex = ref(0)

// 路由带了 userId 且不是自己 → 访问 TA 的墙
const myUserId = resolveMyUserId()
const routeUserId = computed(() => {
  const id = route.params.userId
  return id != null && String(id) !== String(myUserId) ? id : null
})
const isOther = computed(() => !!routeUserId.value)

function resolveMyUserId() {
  try {
    const raw = localStorage.getItem('token')
    if (!raw) return null
    const payload = JSON.parse(atob(raw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.userId ?? payload.uid ?? payload.id ?? payload.sub ?? null
  } catch (e) {
    return null
  }
}

// 灯箱用扁平照片流：把各月份区间按顺序展开，索引全局连续
const photos = computed(() => groups.value.flatMap((g) => g.photos || []))

function imgUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  return 'http://localhost:8080' + url
}

function monthKey(g) {
  return `${g.year || 0}-${String(g.month || 0).padStart(2, '0')}`
}
function monthZh(m) {
  const zh = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
  return zh[m] || String(m)
}
function navLabel(g) {
  return g.month ? `${String(g.year).slice(-2)}·${String(g.month).padStart(2, '0')}` : g.label
}
function scrollToMonth(g) {
  const el = document.getElementById('month-' + monthKey(g))
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
// 某区间内第 i 张在全局扁平流中的索引
function globalIndexOf(g, i) {
  let offset = 0
  for (const group of groups.value) {
    if (group === g) break
    offset += (group.photos || []).length
  }
  return offset + i
}

// 拍立得卡片的轻微旋转：由 id 派生，保证每张不同但稳定
function polaroidStyle(photo, index) {
  const id = String(photo.id)
  const seed = id.charCodeAt(0) + id.charCodeAt(id.length - 1)
  const rotate = ((seed % 7) - 3) * 0.8
  return {
    '--rotate': `${rotate}deg`,
    '--delay': `${index * 0.06}s`,
  }
}

async function fetchPhotos() {
  loading.value = true
  denied.value = ''
  try {
    let data
    if (isOther.value) {
      // BusinessException 是 HTTP 200 + body code=400，需在这里手动识别
      const res = await getOtherPhotosGrouped(routeUserId.value)
        .catch((err) => err?.response?.data || err?.data)  // 兜底：拦截器 reject 的对象
      if (res && res.code !== undefined && res.code !== 200) {
        denied.value = res.message || '无法查看 TA 的照片墙'
        groups.value = []
        return
      }
      data = res?.data !== undefined ? res.data : res
    } else {
      if (mode.value === 'year') {
        data = await getYearPhotosGrouped(selectedYear.value)
      } else {
        const loader = mode.value === 'anniversary' ? getAnniversaryPhotosGrouped : getMyPhotosGrouped
        data = await loader()
      }
    }
    groups.value = Array.isArray(data) ? data : []
  } catch (e) {
    // 错误提示由 main.js 响应拦截器统一弹出
    groups.value = []
  } finally {
    loading.value = false
  }
}

async function fetchVisibility() {
  try {
    visibility.value = (await getPhotoWallVisibility()) ?? 0
  } catch (e) { /* 静默，失败时按私密展示 */ }
}

async function toggleVisibility() {
  if (visibilitySaving.value) return
  visibilitySaving.value = true
  const next = visibility.value === 1 ? 0 : 1
  try {
    const res = await setPhotoWallVisibility(next)
    if (res?.code === 200) visibility.value = next
  } catch (e) {
    // 拦截器已弹提示
  } finally {
    visibilitySaving.value = false
  }
}

function goMyWall() {
  router.push('/photowall')
}

function switchMode(next) {
  if (mode.value === next) return
  mode.value = next
  closeLightbox()
  if (next !== 'albums') fetchPhotos()
}

function selectYear(year) {
  if (selectedYear.value === year) return
  selectedYear.value = year
  closeLightbox()
  fetchPhotos()
}

function openLightbox(index) {
  lightboxIndex.value = index
  lightboxOpen.value = true
  document.body.style.overflow = 'hidden'
}

function closeLightbox() {
  lightboxOpen.value = false
  document.body.style.overflow = ''
}

function prevPhoto() {
  const n = photos.value.length
  if (n > 1) lightboxIndex.value = (lightboxIndex.value - 1 + n) % n
}

function nextPhoto() {
  const n = photos.value.length
  if (n > 1) lightboxIndex.value = (lightboxIndex.value + 1) % n
}

function onKeydown(e) {
  if (!lightboxOpen.value) return
  if (e.key === 'Escape') closeLightbox()
  else if (e.key === 'ArrowLeft') prevPhoto()
  else if (e.key === 'ArrowRight') nextPhoto()
}

let stopWatch = null
onMounted(async () => {
  if (logged.value) {
    if (!isOther.value) await fetchVisibility()
    await fetchPhotos()
  }
  window.addEventListener('keydown', onKeydown)
  // 路由参数变化（我的墙 ⇄ TA 的墙）时重新加载
  stopWatch = router.afterEach((to) => {
    if (to.path.startsWith('/photowall')) {
      mode.value = 'mine'
      closeLightbox()
      if (!isOther.value) fetchVisibility()
      fetchPhotos()
    }
  })
})

onBeforeUnmount(() => {
  if (stopWatch) stopWatch()
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.wall-page {
  max-width: 1120px;
  margin: 0 auto;
  padding: 44px 28px 80px;
  min-height: calc(100vh - 72px);
}

/* ---------- 页头 ---------- */
.wall-header {
  text-align: center;
  margin-bottom: 28px;
}
.wall-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.wall-camera {
  width: 26px;
  height: 26px;
  color: var(--c-gold);
}
.wall-title {
  font-family: var(--font-brush);
  font-size: 40px;
  font-weight: 400;
  letter-spacing: 6px;
  margin: 0;
  color: var(--c-gold);
  text-shadow: 0 2px 18px rgba(222, 217, 203, 0.18);
}
.wall-subtitle {
  margin: 10px 0 0;
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--c-gold-dim);
}
.wall-rule {
  display: block;
  width: 120px;
  height: 1px;
  margin: 20px auto 0;
  background: linear-gradient(90deg, transparent, var(--c-gold-dim), transparent);
}

/* ---------- tab 切换 ---------- */
.wall-tabs {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 34px;
}
.wall-tab {
  font-family: var(--font-body);
  font-size: 14px;
  letter-spacing: 3px;
  color: var(--txt-2);
  background: rgba(220, 230, 244, 0.04);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  padding: 8px 24px;
  cursor: pointer;
  transition: color 0.25s ease, border-color 0.25s ease, background 0.25s ease;
}
.wall-tab:hover {
  color: var(--txt-1);
  border-color: var(--c-gold-dim);
}
.wall-tab.active {
  color: var(--c-gold);
  border-color: var(--c-gold-dim);
  background: rgba(222, 217, 203, 0.08);
}

/* ---------- 可见性开关 ---------- */
.visibility-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: -12px 0 30px;
}
.visibility-label {
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--txt-3);
}
.visibility-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-body);
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--c-gold-dim);
  background: rgba(220, 230, 244, 0.04);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  padding: 6px 16px;
  cursor: pointer;
  transition: color 0.25s ease, border-color 0.25s ease, background 0.25s ease;
}
.visibility-toggle:hover:not(:disabled) { border-color: var(--c-gold-dim); }
.visibility-toggle:disabled { opacity: 0.6; cursor: default; }
.visibility-toggle.public { color: var(--c-gold); border-color: var(--c-gold-dim); }
.visibility-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--txt-3);
}
.visibility-toggle.public .visibility-dot {
  background: var(--c-gold);
  box-shadow: 0 0 8px var(--c-gold);
}

/* ---------- 年度回忆：年份选择 ---------- */
.year-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 18px 0 6px;
}
.year-picker-label {
  font-family: var(--font-brush);
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--c-gold-dim);
  margin-right: 6px;
}
.year-chip {
  font-family: var(--font-body);
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--txt-2);
  background: transparent;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  padding: 6px 16px;
  cursor: pointer;
  transition: color .2s, border-color .2s, background .2s;
}
.year-chip:hover { color: var(--c-gold); border-color: var(--c-gold-dim); }
.year-chip.active {
  color: var(--c-gold);
  border-color: var(--c-gold);
  background: rgba(222, 217, 181, 0.08);
}

/* ---------- 月份导航 ---------- */
.month-nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 10px;
  margin: -8px 0 34px;
}
.month-nav-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-body);
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--c-gold-dim);
  background: rgba(220, 230, 244, 0.04);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  padding: 6px 14px;
  cursor: pointer;
  transition: color 0.25s ease, border-color 0.25s ease, background 0.25s ease;
}
.month-nav-item:hover {
  color: var(--c-gold);
  border-color: var(--c-gold-dim);
  background: rgba(222, 217, 181, 0.08);
}
.month-nav-count {
  font-size: 10px;
  color: var(--txt-3);
  background: rgba(222, 217, 181, 0.1);
  border-radius: 999px;
  padding: 1px 6px;
}

/* ---------- 月份区间 ---------- */
.month-section {
  margin-bottom: 46px;
  scroll-margin-top: 24px;
}
.month-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 4px 22px;
}
.month-year {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 26px;
  letter-spacing: 2px;
  color: var(--c-gold);
  line-height: 1;
}
.month-name {
  font-family: var(--font-brush);
  font-size: 18px;
  letter-spacing: 2px;
  color: var(--txt-1);
}
.month-dot { color: var(--c-gold-dim); }
.month-count {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--txt-3);
}
.month-rule {
  flex: 1;
  height: 1px;
  margin-left: 6px;
  background: linear-gradient(90deg, var(--c-gold-faint), transparent);
}

/* ---------- 加载 / 空状态 ---------- */
.wall-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  min-height: 300px;
  color: var(--c-gold-dim);
  font-size: 13px;
  letter-spacing: 2px;
}
.wall-spinner {
  width: 30px;
  height: 30px;
  border: 2px solid var(--c-gold-faint);
  border-top-color: var(--c-gold);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.wall-empty-text {
  font-family: var(--font-brush);
  font-size: 22px;
}
.wall-login-btn {
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--c-gold);
  text-decoration: none;
  border: 1px solid var(--c-gold-dim);
  border-radius: 2px;
  padding: 8px 22px;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.wall-login-btn:hover {
  background: rgba(222, 217, 181, 0.08);
  border-color: var(--c-gold);
}

/* ---------- 拍立得网格 ---------- */
.polaroid-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 30px 24px;
  padding: 10px 4px;
}
.polaroid {
  position: relative;
  align-self: start;
  background: #e9e6de;
  padding: 8px 8px 34px;
  border-radius: 2px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  transform: rotate(var(--rotate));
  transform-origin: center center;
  animation: polaroid-in 0.55s both;
  animation-delay: var(--delay, 0s);
  transition: transform 0.4s cubic-bezier(0.2, 1.3, 0.4, 1), box-shadow 0.35s ease, z-index 0s;
}
@keyframes polaroid-in {
  from { opacity: 0; transform: translateY(26px) rotate(calc(var(--rotate) * 2)); }
  to { opacity: 1; transform: translateY(0) rotate(var(--rotate)); }
}
.polaroid:hover {
  transform: rotate(0deg) scale(1.045);
  z-index: 20;
  box-shadow: 0 20px 42px rgba(0, 0, 0, 0.62);
}
.polaroid-frame {
  overflow: hidden;
  background: #cfcbc1;
}
.polaroid-img {
  overflow: hidden;
  aspect-ratio: 4 / 3;
}
.polaroid-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.6s ease;
}
.polaroid:hover .polaroid-img img { transform: scale(1.06); }
.polaroid-caption {
  position: absolute;
  bottom: 8px;
  left: 0;
  right: 0;
  text-align: center;
  font-family: Georgia, 'Times New Roman', serif;
  font-style: italic;
  font-size: 12px;
  color: #6b675f;
  padding: 0 62px 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 胶带装饰 */
.tape {
  position: absolute;
  top: -8px;
  left: 50%;
  width: 42px;
  height: 15px;
  background: rgba(222, 217, 203, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 1px;
  transform: translateX(-50%) rotate(-5deg);
  backdrop-filter: blur(2px);
}
/* 那年今日角标 */
.years-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 3;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(24, 26, 32, 0.82);
  color: var(--c-gold);
  font-size: 11px;
  letter-spacing: 1px;
}
/* 点赞区（拍立得底部右侧，深色文字适配浅色相纸） */
.polaroid-like {
  position: absolute;
  bottom: 7px;
  right: 10px;
  z-index: 3;
}
.polaroid-like :deep(.like-btn) { color: #8a857a; }
.polaroid-like :deep(.like-btn.liked) { color: #b4647a; }
.polaroid-like :deep(.heart) { font-size: 14px; }
.polaroid-like :deep(.num) { font-size: 11px; }

/* ---------- 卷末 ---------- */
.wall-end {
  text-align: center;
  margin-top: 44px;
  font-size: 12px;
  letter-spacing: 4px;
  color: var(--c-gold-faint);
}

/* ---------- 灯箱 ---------- */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lb-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(5, 6, 9, 0.9);
  backdrop-filter: blur(6px);
}
.lb-stage {
  position: relative;
  z-index: 2;
  max-width: 88vw;
  max-height: 84vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.lb-stage img {
  max-width: 88vw;
  max-height: 74vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(222, 217, 203, 0.14);
}
.lb-caption {
  margin: 16px 0 0;
  font-family: Georgia, serif;
  font-style: italic;
  font-size: 14px;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
}
.lb-years {
  margin: 6px 0 0;
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--c-gold-dim);
}
.lb-like {
  margin-top: 14px;
}
.lb-close, .lb-nav {
  position: absolute;
  z-index: 3;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid rgba(222, 217, 203, 0.25);
  background: rgba(255, 255, 255, 0.06);
  color: var(--c-gold);
  cursor: pointer;
  transition: background 0.25s ease, border-color 0.25s ease;
}
.lb-close:hover, .lb-nav:hover {
  background: rgba(222, 217, 203, 0.14);
  border-color: var(--c-gold);
}
.lb-close {
  top: 26px;
  right: 32px;
  width: 40px;
  height: 40px;
  font-size: 24px;
  line-height: 1;
}
.lb-nav {
  top: 50%;
  transform: translateY(-50%);
  width: 46px;
  height: 46px;
  font-size: 30px;
  line-height: 1;
}
.lb-prev { left: 32px; }
.lb-next { right: 32px; }
.lb-counter {
  position: absolute;
  bottom: 26px;
  left: 0;
  right: 0;
  z-index: 3;
  text-align: center;
  font-size: 13px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.5);
}
.lb-fade-enter-active, .lb-fade-leave-active { transition: opacity 0.3s ease; }
.lb-fade-enter-from, .lb-fade-leave-to { opacity: 0; }
.lb-slide-enter-active, .lb-slide-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.lb-slide-enter-from { opacity: 0; transform: scale(0.96); }
.lb-slide-leave-to { opacity: 0; transform: scale(1.03); }

/* ---------- 响应式 ---------- */
@media (max-width: 900px) {
  .polaroid-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px 18px; }
}
@media (max-width: 600px) {
  .wall-page { padding: 32px 16px 60px; }
  .wall-title { font-size: 32px; }
  .polaroid-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 12px; }
  .lb-nav { width: 38px; height: 38px; font-size: 24px; }
  .lb-prev { left: 12px; }
  .lb-next { right: 12px; }
  .lb-close { top: 16px; right: 16px; }
}
</style>
