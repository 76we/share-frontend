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
        <button
          v-if="canApplyFriend && !friendRequested"
          class="wall-login-btn"
          @click="applyFriend"
        >申请添加 TA 为好友</button>
        <p v-else-if="friendRequested" class="wall-friend-note">好友申请已发出，等待 TA 同意后即可查看</p>
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
        <button
          class="wall-tab"
          :class="{ active: mode === 'friends' }"
          @click="switchMode('friends')"
        >好友墙</button>
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

      <!-- 可见性开关（仅自己的墙显示）：三档 私密 / 仅好友 / 公开 -->
      <div v-if="!isOther && mode === 'mine'" class="visibility-row">
        <span class="visibility-label">谁可以看我的照片墙</span>
        <button
          v-for="v in [0, 2, 1]"
          :key="v"
          class="visibility-toggle"
          :class="{ active: visibility === v }"
          @click="pickVisibility(v)"
          :disabled="visibilitySaving"
        >
          <span class="visibility-dot"></span>
          {{ v === 0 ? '私密' : v === 2 ? '仅好友' : '公开' }}
        </button>
      </div>

      <template v-if="mode !== 'albums'">

      <!-- ===== 好友墙模式：每位好友一节 ===== -->
      <template v-if="mode === 'friends'">
        <!-- 加载中 -->
        <div v-if="loading && friendGroups.length === 0" class="wall-state">
          <span class="wall-spinner"></span>
          <p>正在收集好友的光影…</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="friendGroups.length === 0" class="wall-state">
          <p class="wall-empty-text">{{ emptyHint }}</p>
          <router-link to="/profile" class="wall-login-btn">去添加好友</router-link>
        </div>

        <template v-else>
          <!-- 每位好友一节 -->
          <section v-for="f in friendGroups" :key="f.friendId" class="friend-section">
            <header class="friend-head">
              <span class="friend-avatar">
                <img v-if="f.friendAvatar" :src="imgUrl(f.friendAvatar)" alt="" />
                <span v-else>{{ (f.friendName || '尘').charAt(0) }}</span>
              </span>
              <span class="friend-name">{{ f.friendName }}</span>
              <span class="friend-count">· {{ f.totalCount }} 张照片</span>
              <button class="friend-view" @click="router.push(`/photowall/${f.friendId}`)">看 TA 的墙</button>
            </header>
            <div class="polaroid-grid">
              <div
                v-for="(photo, i) in f.photos"
                :key="photo.id"
                class="polaroid"
                :style="polaroidStyle(photo, i)"
                @click="openLightbox(friendGlobalIndexOf(f, i))"
              >
                <span class="tape"></span>
                <div class="polaroid-frame">
                  <div class="polaroid-img" :style="{ '--ar': aspects[photo.id] || 1.3333 }">
                    <img
                      :src="imgUrl(photo.url)"
                      :alt="photo.caption || '照片'"
                      loading="lazy"
                      @load="onPhotoLoad($event, photo)"
                    />
                  </div>
                </div>
                <span v-if="photo.caption" class="polaroid-caption">{{ photo.caption }}</span>
                <span class="polaroid-like" @click.stop>
                  <LikeButton :target-id="photo.id" :target-type="3" :initial="photo.likeCount || 0" />
                </span>
              </div>
            </div>
          </section>

          <p class="wall-end">— 已至卷末 —</p>
        </template>
      </template>

      <!-- ===== 月份模式：原有结构 ===== -->
      <template v-else>
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
                <div class="polaroid-img" :style="{ '--ar': aspects[photo.id] || 1.3333 }">
                  <img
                    :src="imgUrl(photo.url)"
                    :alt="photo.caption || '照片'"
                    loading="lazy"
                    @load="onPhotoLoad($event, photo)"
                  />
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

    <!-- 灯箱：左图右笺 —— 照片本来就是某篇文字的配图，展开时不能把它从文章里撕下来 -->
    <transition name="lb-fade">
      <div
        v-if="lightboxOpen"
        class="lightbox"
        :class="{ 'is-full': fullView }"
        @click="closeLightbox"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <div class="lb-backdrop"></div>
        <button class="lb-close" @click.stop="closeLightbox" aria-label="关闭">×</button>
        <button
          v-if="photos.length > 1"
          class="lb-nav lb-prev"
          @click.stop="prevPhoto"
          aria-label="上一张"
        >‹</button>

        <div v-if="currentPhoto" class="lb-stage" @click.stop>
          <figure class="lb-figure">
            <img
              :key="currentPhoto.id"
              class="lb-photo"
              :src="imgUrl(currentPhoto.url)"
              :alt="currentPhoto.caption || '照片'"
              @dblclick="toggleFull"
            />
            <!-- 相纸边：图片不能裸在黑底上，底部留一条纸，写题与页码 -->
            <figcaption class="lb-plate">
              <span class="lb-plate-cap">
                {{ currentPhoto.caption || '无题' }}
                <em
                  v-if="mode === 'anniversary' && currentPhoto.yearsAgo"
                  class="lb-plate-years"
                >{{ currentPhoto.yearsAgo }} 年前的今天</em>
              </span>
              <span class="lb-plate-right">
                <span class="lb-plate-like" @click.stop>
                  <LikeButton
                    :target-id="currentPhoto.id"
                    :target-type="3"
                    :initial="currentPhoto.likeCount || 0"
                  />
                </span>
                <span class="lb-plate-idx">{{ lightboxIndex + 1 }} / {{ photos.length }}</span>
                <button
                  class="lb-plate-full"
                  :title="fullView ? '退出细看' : '细看这张'"
                  aria-label="细看"
                  @click.stop="toggleFull"
                >⤢</button>
              </span>
            </figcaption>
          </figure>

          <!-- 笺：这张照片出自的那一篇。取不到就整栏不出现，退回纯图片 -->
          <aside v-if="momentInfo" class="lb-note" :key="'note-' + momentInfo.id">
            <span class="lb-note-kicker">出 自</span>
            <h3 v-if="momentInfo.title" class="lb-note-title">{{ momentInfo.title }}</h3>
            <p class="lb-note-text" :class="{ 'is-lead': !momentInfo.title }">
              {{ momentInfo.content || '这一篇只留了图，没有字。' }}
            </p>
            <p class="lb-note-meta">
              <span>{{ noteDate }}</span>
              <template v-if="momentInfo.location">
                <span class="lb-note-sep">·</span>
                <span>{{ momentInfo.location }}</span>
              </template>
            </p>
            <router-link :to="`/detail/${momentInfo.id}`" class="lb-note-more">读全文 →</router-link>
          </aside>
        </div>

        <button
          v-if="photos.length > 1"
          class="lb-nav lb-next"
          @click.stop="nextPhoto"
          aria-label="下一张"
        >›</button>

        <!-- 底部进度：不打扰，但让人知道「我翻到哪了」 -->
        <div v-if="photos.length > 1" class="lb-progress">
          <span
            class="lb-progress-fill"
            :style="{ width: ((lightboxIndex + 1) / photos.length) * 100 + '%' }"
          ></span>
        </div>
        <button v-if="fullView" class="lb-full-exit" @click.stop="toggleFull">退出细看</button>
      </div>
    </transition>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import {
  getMyPhotosGrouped, getAnniversaryPhotosGrouped, getOtherPhotosGrouped,
  getYearPhotosGrouped, getPhotoWallVisibility, setPhotoWallVisibility,
  getFriendPhotos,
} from '../utils/photoWallApi'
import { requestFriend } from '../utils/friendshipApi'
import LikeButton from '../components/LikeButton.vue'
import AlbumManager from '../components/AlbumManager.vue'
import { imgUrl } from '../utils/url'

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
  friends: '还没有好友，添加朋友后 TA 的照片会出现在这里',
}[mode.value] || '还没有照片，发一条带图动态吧'))
const loading = ref(false)
const denied = ref('')                   // 访问他人私密墙时的提示
// 仅"仅好友"档被拒时，申请好友才有用（私密档加了好友也看不到）
const canApplyFriend = computed(() => denied.value.includes('好友'))

const visibility = ref(0)                // 0私密 1公开 2仅好友
const visibilitySaving = ref(false)
const friendRequested = ref(false)       // 向 TA 发起过好友申请

// 好友墙：每位好友近期照片，按好友分段 [{ friendId, friendName, friendAvatar, totalCount, photos }]
const friendGroups = ref([])

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
const photos = computed(() => mode.value === 'friends'
  ? friendGroups.value.flatMap((g) => g.photos || [])
  : groups.value.flatMap((g) => g.photos || []))

const currentPhoto = computed(() => photos.value[lightboxIndex.value] || null)

/* 灯箱的「细看」模式：双击把照片放到 96vw×88vh，藏起笺与相纸边。
   不做像素级缩放 —— 这些是随手拍的片子，人要的是「看大一点」，不是数像素。 */
const fullView = ref(false)

/* 照片真实宽高比。后端的 moment_image 只有 url，没有宽高，
   所以只能等图加载完读 naturalWidth；读到前先用 4:3 占位。
   竖图以前被硬裁成 4:3（人像、天空都缺半截），现在按真比例显示。 */
const aspects = ref({})
function onPhotoLoad(e, photo) {
  const img = e.target
  if (!img?.naturalWidth || !img.naturalHeight) return
  // 极端长图（全景、截屏）会把整面墙拉歪，钳在 0.66–1.8 之间
  const ratio = Math.min(1.8, Math.max(0.66, img.naturalWidth / img.naturalHeight))
  if (Math.abs((aspects.value[photo.id] || 0) - ratio) < 0.01) return
  aspects.value = { ...aspects.value, [photo.id]: ratio }
}

/* 灯箱右侧的「笺」：当前照片出自的那篇动态。
   接口里的 WallPhotoVO 已经带了 momentId，但列表里没有正文，
   所以展开时补拉一次详情；按 momentId 缓存，来回翻不重复请求。 */
const momentInfo = ref(null)
const momentCache = new Map()
let momentSeq = 0   // 连续切图时丢弃过期响应

async function loadMomentFor(index) {
  const mid = photos.value[index]?.momentId
  const seq = ++momentSeq
  if (!mid) {
    momentInfo.value = null
    return
  }
  if (momentCache.has(mid)) {
    momentInfo.value = momentCache.get(mid)
    return
  }
  momentInfo.value = null
  try {
    const res = await axios.get(`/moments/${mid}`)
    if (seq !== momentSeq) return
    const data = res.data?.data
    if (data) {
      momentCache.set(mid, data)
      momentInfo.value = data
    }
  } catch (e) {
    // 原文取不到就只显示图，不打扰用户
    if (seq === momentSeq) momentInfo.value = null
  }
}

const noteDate = computed(() => fmtNoteDate(momentInfo.value?.createTime))

function fmtNoteDate(t) {
  if (!t) return ''
  const d = new Date(String(t).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  const md = `${d.getMonth() + 1}月${d.getDate()}日`
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return d.getFullYear() === new Date().getFullYear() ? `${md} ${hm}` : `${d.getFullYear()}年${md}`
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
// 好友墙：某好友节内第 i 张在全局扁平流（跨所有好友）中的索引
function friendGlobalIndexOf(fg, i) {
  let offset = 0
  for (const f of friendGroups.value) {
    if (f === fg) break
    offset += (f.photos || []).length
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

async function pickVisibility(v) {
  if (visibilitySaving.value || v === visibility.value) return
  visibilitySaving.value = true
  try {
    const res = await setPhotoWallVisibility(v)
    if (res?.code === 200) visibility.value = v
  } catch (e) {
    // 拦截器已弹提示
  } finally {
    visibilitySaving.value = false
  }
}

async function applyFriend() {
  if (!isOther.value || friendRequested.value) return
  friendRequested.value = true
  try {
    await requestFriend(routeUserId.value)
    // 申请成功后刷新一下（可能已同意则能看到墙）
    fetchPhotos()
  } catch (e) {
    friendRequested.value = false
  }
}

function goMyWall() {
  router.push('/photowall')
}

function switchMode(next) {
  if (mode.value === next) return
  mode.value = next
  closeLightbox()
  if (next === 'friends') fetchFriends()
  else if (next !== 'albums') fetchPhotos()
}

async function fetchFriends() {
  loading.value = true
  denied.value = ''
  try {
    const data = await getFriendPhotos(6)
    friendGroups.value = Array.isArray(data) ? data : []
  } catch (e) {
    friendGroups.value = []
  } finally {
    loading.value = false
  }
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
  fullView.value = false
  document.body.style.overflow = 'hidden'
  preloadNeighbors(index)
}

function closeLightbox() {
  lightboxOpen.value = false
  fullView.value = false
  document.body.style.overflow = ''
  momentSeq++            // 关掉时丢弃还在路上的详情响应
  momentInfo.value = null
}

function prevPhoto() {
  const n = photos.value.length
  if (n > 1) lightboxIndex.value = (lightboxIndex.value - 1 + n) % n
}

function nextPhoto() {
  const n = photos.value.length
  if (n > 1) lightboxIndex.value = (lightboxIndex.value + 1) % n
}

/* 预取相邻两张：切图时图已在缓存里，不会白闪一下再出现。
   只取 ±2，取多了等于把整本相册下载一遍。 */
const preloaded = new Set()
function preloadNeighbors(index) {
  const n = photos.value.length
  for (const d of [1, -1, 2, -2]) {
    if (n <= 1) break
    const p = photos.value[(index + d + n * 2) % n]
    if (!p?.url) continue
    const src = imgUrl(p.url)
    if (preloaded.has(src)) continue
    preloaded.add(src)
    const im = new Image()
    im.src = src
  }
}

function toggleFull() {
  fullView.value = !fullView.value
}

/* 触屏左右滑动切图。纵向滚动 / 细看模式下的拖动都不算。 */
let touchStart = null
function onTouchStart(e) {
  if (fullView.value) return
  const t = e.changedTouches?.[0]
  if (!t) return
  touchStart = { x: t.clientX, y: t.clientY, at: Date.now() }
}
function onTouchEnd(e) {
  const s = touchStart
  touchStart = null
  if (!s) return
  const t = e.changedTouches?.[0]
  if (!t) return
  const dx = t.clientX - s.x
  const dy = t.clientY - s.y
  // 横向位移要够长、且明显大于竖向，否则是在上下滚页面或误触
  if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.4) return
  if (Date.now() - s.at > 800) return
  if (dx < 0) nextPhoto()
  else prevPhoto()
}

function onKeydown(e) {
  if (!lightboxOpen.value) return
  if (e.key === 'Escape') {
    if (fullView.value) fullView.value = false
    else closeLightbox()
  } else if (e.key === 'ArrowLeft') prevPhoto()
  else if (e.key === 'ArrowRight') nextPhoto()
}

// 打开或切换照片时，补拉这一张所属的那篇（有缓存则瞬间出），并预取相邻
watch([lightboxOpen, lightboxIndex], ([open, idx]) => {
  if (!open) return
  loadMomentFor(idx)
  preloadNeighbors(idx)
})

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

/* ---------- 好友墙：每位好友一节 ---------- */
.friend-section {
  margin-bottom: 36px;
}
.friend-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--card-border);
  margin-bottom: 22px;
}
.friend-avatar {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--c-gold-dim);
  box-shadow: 0 0 0 3px var(--c-gold-faint);
  background: rgba(222, 217, 203, 0.08);
  color: var(--c-gold);
  font-family: var(--font-brush);
  font-size: 18px;
}
.friend-avatar img { width: 100%; height: 100%; object-fit: cover; }
.friend-name {
  font-family: var(--font-brush);
  font-size: 20px;
  letter-spacing: 2px;
  color: var(--c-gold);
}
.friend-count {
  font-size: 12px;
  color: var(--c-gold-dim);
  letter-spacing: 1px;
}
.friend-view {
  margin-left: auto;
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--c-gold-dim);
  background: transparent;
  border: 1px solid var(--card-border);
  border-radius: 2px;
  padding: 5px 14px;
  cursor: pointer;
  transition: color 0.25s ease, border-color 0.25s ease;
}
.friend-view:hover { color: var(--c-gold); border-color: var(--c-gold-dim); }

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
.visibility-toggle.active { color: var(--c-gold); border-color: var(--c-gold-dim); background: rgba(232, 217, 181, 0.06); }
.visibility-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--txt-3);
}
.visibility-toggle.active .visibility-dot {
  background: var(--c-gold);
  box-shadow: 0 0 8px var(--c-gold);
}
/* 访问他人墙被拒时的申请好友提示 */
.wall-friend-note {
  margin: 4px 0 0;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--c-gold-dim);
  text-align: center;
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
  /* 每张按自己的真实宽高比排（--ar 由图片 onload 读 naturalWidth 写入）。
     原来一律 4:3，竖构图的人像和天空都被切掉半截。 */
  aspect-ratio: var(--ar, 4 / 3);
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
  /* 包裹层自己也要定深色：它继承的是页面主文字色（近白），
     在米白相纸上等于隐形，将来往里加任何字都会中招 */
  color: #6b675e;
}
/* 相纸是米白的，全局 --txt-3 那套浅灰在上面几乎看不见。
   取 #6b675e：在 rgb(233,230,222) 上对比度约 4.6，过 AA，又不至于比题字更抢眼。
   灯箱纸边用同一组色，两处才是同一张纸。 */
.polaroid-like :deep(.like-btn) { color: #6b675e; }
.polaroid-like :deep(.like-btn:hover) { color: #3a352d; }
.polaroid-like :deep(.like-btn.liked) { color: #a8546c; }
.polaroid-like :deep(.heart) { font-size: 14px; }
.polaroid-like :deep(.num) { font-size: 11px; }

/* ---------- 卷末 ---------- */
.wall-end {
  text-align: center;
  margin-top: 44px;
  font-size: 12px;
  letter-spacing: 4px;
  /* 原为 --c-gold-faint（0.14），实测对比度 1.34，等于没写 */
  color: rgba(222, 217, 203, 0.5);
}

/* ---------- 灯箱 ---------- */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 左右留出翻页键的槽位：原来图几乎贴着屏幕边，‹ 箭头有一半压在图上 */
  padding: 0 96px;
}
.lb-backdrop {
  position: absolute;
  inset: 0;
  /* 0.9 时下面的拍立得网格会隐约透出来，正文压在上面就脏了；
     压到 0.975 保留一点空间感，又不至于干扰阅读 */
  background: rgba(8, 9, 12, 0.985);
  backdrop-filter: blur(20px);
}
/* 左图右笺：图按自身比例铺开，右侧一条窄栏放这篇的原文 */
.lb-stage {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: row;
  /* 顶部对齐：图的顶边和「出自」那行齐平，读起来才像一篇排版好的稿子 */
  align-items: flex-start;
  gap: 38px;
  max-width: 100%;
  max-height: 92vh;
}
.lb-figure {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 0 1 auto;
  margin: 0;
}
.lb-photo {
  display: block;
  max-width: 100%;
  /* 68vh：给相纸边、关闭键和底部进度留出空间；
     切换照片时高度会跟着比例变，这是对的 —— 照片本来就该是它自己的形状 */
  max-height: min(68vh, 640px);
  width: auto;
  height: auto;
  border-radius: 3px 3px 0 0;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(222, 217, 203, 0.14);
  border-bottom: none;
  animation: lb-photo-in 0.34s cubic-bezier(0.22, 0.8, 0.3, 1);
}
/* 切图不再整块缩放：只让新图淡入，旧图立刻让位，翻页是「换一张」不是「转场」 */
@keyframes lb-photo-in {
  from { opacity: 0; transform: scale(0.985); }
  to { opacity: 1; transform: scale(1); }
}
/* 相纸下沿：图片不该裸在黑底上，留一条纸写题与页码 */
.lb-plate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 44px;
  padding: 9px 14px;
  background: rgba(238, 234, 226, 0.94);
  border-radius: 0 0 3px 3px;
  box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.7);
}
.lb-plate-cap {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  font-family: Georgia, 'Songti SC', serif;
  font-size: 14px;
  letter-spacing: 1px;
  color: #3a342d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lb-plate-years {
  font-size: 11px;
  font-style: normal;
  letter-spacing: 2px;
  color: #8a7d68;
}
.lb-plate-right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: none;
}
/* 相纸是浅色，全局的暗色点赞变量在这条纸上几乎看不见，就地覆盖 */
.lb-plate-like :deep(.like-btn) { color: #6b675e; }
.lb-plate-like :deep(.like-btn.liked) { color: #a8546c; }
.lb-plate-idx {
  font-size: 11px;
  letter-spacing: 2px;
  color: #8a7d68;
  font-variant-numeric: tabular-nums;
}
/* 相纸右下角的「细看」：双击能放大，但双击是藏起来的动作，得有个看得见的入口 */
.lb-plate-full {
  width: 22px;
  height: 22px;
  margin-left: -4px;
  display: grid;
  place-items: center;
  font-size: 13px;
  line-height: 1;
  color: #8a7d68;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}
.lb-plate-full:hover { color: #3a342d; border-color: rgba(58, 52, 45, 0.3); }

/* 右侧笺栏 */
.lb-note {
  width: 300px;
  flex: none;
  /* 拉到与图片等高：一根竖线贯穿整张照片，像杂志的边栏，
     而不是一小段悬在半空的字 */
  align-self: stretch;
  display: flex;
  flex-direction: column;
  gap: 13px;
  /* 顶边与图片齐平（图有 1px 边框，这里补 1px 视觉对齐） */
  padding: 1px 2px 2px 24px;
  border-left: 1px solid rgba(222, 217, 203, 0.16);
  max-height: 68vh;
  overflow: hidden;
  animation: lb-note-in 0.45s ease 0.05s both;
}
@keyframes lb-note-in {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: translateX(0); }
}
.lb-note-kicker {
  font-size: 11px;
  letter-spacing: 5px;
  color: var(--c-gold);
  opacity: 0.85;
}
.lb-note-title {
  margin: 0;
  font-family: 'Ma Shan Zheng', 'ZCOOL XiaoWei', Georgia, serif;
  font-size: 22px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: 2px;
  color: rgba(245, 242, 236, 0.96);
}
.lb-note-text {
  margin: 0;
  font-size: 13.5px;
  line-height: 2;
  color: rgba(240, 237, 231, 0.72);
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.lb-note-text.is-lead {
  font-size: 14.5px;
  color: rgba(240, 237, 231, 0.86);
}
.lb-note-meta {
  margin: 0;
  /* 把日期与「读全文」压到栏底：一块笺，上下都有落点 */
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  letter-spacing: 1.5px;
  color: rgba(222, 217, 203, 0.5);
}
.lb-note-sep { opacity: 0.6; }
.lb-note-more {
  align-self: flex-start;
  font-size: 12.5px;
  letter-spacing: 2px;
  color: var(--c-gold);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: color 0.25s ease, border-color 0.25s ease;
}
.lb-note-more:hover {
  color: #f4eeda;
  border-bottom-color: rgba(232, 217, 181, 0.5);
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
.lb-prev { left: 28px; }
.lb-next { right: 28px; }
.lb-fade-enter-active, .lb-fade-leave-active { transition: opacity 0.3s ease; }
.lb-fade-enter-from, .lb-fade-leave-to { opacity: 0; }

/* 细看模式：藏起笺与相纸，只留照片。双击切换 */
.lightbox.is-full { padding: 0 80px; }
.lightbox.is-full .lb-note,
.lightbox.is-full .lb-plate { display: none; }
.lightbox.is-full .lb-photo {
  max-height: 88vh;
  max-width: 100%;
  border-radius: 3px;
  border-bottom: 1px solid rgba(222, 217, 203, 0.14);
}
.lb-full-exit {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  padding: 6px 18px;
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 3px;
  color: rgba(240, 237, 231, 0.72);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(222, 217, 203, 0.2);
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}
.lb-full-exit:hover {
  color: var(--c-gold);
  border-color: var(--c-gold);
  background: rgba(222, 217, 203, 0.12);
}

/* 底部进度：翻到第几张，一条线就说完了，不必再加一个计数器 */
.lb-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  height: 2px;
  background: rgba(222, 217, 203, 0.08);
}
.lb-progress-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, rgba(232, 217, 181, 0.35), rgba(232, 217, 181, 0.75));
  transition: width 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ---------- 响应式 ---------- */
@media (max-width: 900px) {
  .polaroid-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px 18px; }

  /* 灯箱：竖屏放不下左右两栏，改为图在上、笺在下 */
  .lightbox { padding: 0 16px; }
  .lightbox.is-full { padding: 0 12px; }
  .lb-stage {
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 100%;
    /* 底部留出翻页按钮的位置，否则箭头会压在相纸上 */
    max-height: 82vh;
  }
  .lb-photo { max-height: 56vh; }
  .lightbox.is-full .lb-photo { max-height: 84vh; }
  /* 箭头从「贴图两侧」改成「屏幕底部」：
     手机上 46px 的圆浮在图片左右边缘，拇指够不到，还会挡住相纸 */
  .lb-nav {
    top: auto;
    bottom: 18px;
    transform: none;
    width: 40px;
    height: 40px;
    font-size: 24px;
  }
  .lb-prev { left: 18px; }
  .lb-next { right: 18px; }
  .lb-note {
    width: min(100%, 520px);
    max-height: none;
    gap: 8px;
    padding: 14px 0 0;
    border-left: none;
    border-top: 1px solid rgba(222, 217, 203, 0.16);
  }
  .lb-note-title { font-size: 17px; }
  .lb-note-text {
    font-size: 12.5px;
    line-height: 1.9;
    -webkit-line-clamp: 4;
  }
  .lb-note-text.is-lead { font-size: 13px; }
  .lb-note-more { margin-top: 4px; }
}
@media (max-width: 600px) {
  .wall-page { padding: 32px 16px 60px; }
  .wall-title { font-size: 32px; }
  .polaroid-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 12px; }
  .lb-nav { width: 38px; height: 38px; font-size: 24px; }
  .lb-prev { left: 12px; }
  .lb-next { right: 12px; }
  .lb-close { top: 16px; right: 16px; }

  /* 5 个胶囊在 390px 下总宽超过视口，居中布局把第一个顶出左边界 5px，
     文字又被压成一字一行，配 999px 圆角直接变成一排圆球。
     这里允许换行，并禁止标签内部折字。 */
  .wall-tabs {
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 22px;
  }
  .wall-tab {
    flex: none;
    padding: 6px 14px;
    font-size: 12.5px;
    letter-spacing: 1px;
    white-space: nowrap;
  }
  .visibility-row {
    flex-wrap: wrap;
    gap: 8px 10px;
    margin: -6px 0 24px;
  }
  .visibility-label { flex: 1 0 100%; text-align: center; }
  .visibility-toggle {
    flex: none;
    padding: 6px 12px;
    white-space: nowrap;
  }
}
</style>
