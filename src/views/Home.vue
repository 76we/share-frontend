<!-- src/views/Home.vue —— 首页信息流（尘叙阁·暗色玄幻风）
     三栏杂志式布局：左「主题卷目」+ 中「主信息流」+ 右「风华榜」
     调用 GET /moments/list（分页 + 话题筛选 + 时间/热度排序）、GET /topics（话题筛选） -->
<template>
  <div class="home-wrap">
    <!-- ==================== 首屏入场：星尘粒子 + 视频 + 左右分栏（幻梦风） ==================== -->
    <section class="entry-hero" ref="heroSection">
      <div class="entry-video-wrap" aria-hidden="true">
        <video ref="entryVideo" class="entry-video" autoplay loop muted playsinline preload="metadata">
          <source src="/chenxu-bg.mp4" type="video/mp4" />
        </video>
        <div class="entry-video-mask"></div>
      </div>
      <!-- 星尘 / 萤火 / 流星粒子层（纯 Canvas，离屏自动暂停） -->
      <canvas ref="particleCanvas" class="entry-particles" aria-hidden="true"></canvas>

      <div class="entry-inner">
        <!-- 左：品牌文字区 -->
        <div class="entry-copy">
          <p class="entry-greeting">尘世过客，欢迎归来</p>
          <h1 class="entry-title flow-text">尘叙阁</h1>
          <p class="entry-en">CHEN XU PAVILION</p>
          <span class="entry-role">&gt;_ 玄幻叙事 · 心事分享</span>
          <p class="entry-desc">
            这里收藏山河旧梦，也叙说凡人心事。<br />
            愿你在此，寻一卷共鸣，落一笔浮生。
          </p>
          <div class="entry-actions">
            <button class="entry-btn entry-btn-primary" @click="scrollToScene">浏览动态</button>
            <router-link to="/publish" class="entry-btn entry-btn-ghost">提笔落叙</router-link>
          </div>
        </div>

        <!-- 右：毛玻璃诗句卡片 -->
        <div class="entry-glass">
          <span class="glass-mark">“</span>
          <p class="glass-verse">{{ typedVerse }}<span class="type-cursor"></span></p>
          <p class="glass-sign">— 尘叙阁</p>
        </div>
      </div>

      <!-- 向下探索：平滑滚动进入正式应用场景 -->
      <div class="entry-scroll" @click="scrollToScene">
        <span class="entry-scroll-text">向下滚动探索</span>
        <span class="entry-scroll-arrow">⌄</span>
      </div>

      <!-- 右下悬浮工具栏：发布 / 回到顶部 -->
      <div class="entry-float">
        <router-link to="/publish" class="float-btn" title="提笔落叙">
          <span class="float-ico">✎</span>
        </router-link>
        <button class="float-btn" title="回到顶部" @click="scrollToTop">
          <span class="float-ico">↑</span>
        </button>
      </div>
    </section>

    <!-- ==================== 应用场景：三栏信息流 ==================== -->
    <div class="home" ref="sceneRef">
    <!-- ============ 左栏：主题卷目 ============ -->
    <aside class="home-aside aside-left">
      <!-- 卷首小引 -->
      <div class="side-card intro-card">
        <span class="seal intro-seal">尘</span>
        <h2 class="intro-name">尘叙阁</h2>
        <p class="intro-en">CHEN XU PAVILION</p>
        <div class="ornament intro-ornament"><span class="ornament-diamond"></span></div>
        <p class="intro-verse">尘世一隅<br />叙说心事</p>
        <router-link to="/publish" class="pub-link">
          <span>提笔落叙</span>
          <span class="pub-arrow">→</span>
        </router-link>
      </div>

      <!-- 主题卷目：话题导航 -->
      <div class="side-card topic-card">
        <div class="side-heading"><span>主 题 卷 目</span></div>
        <nav class="topic-nav">
          <span
            class="topic-item"
            :class="{ active: !topicId }"
            @click="pickTopic('')"
          ><i class="topic-dot"></i><span>全部</span></span>
          <span
            v-for="t in topics"
            :key="t.id"
            class="topic-item"
            :class="{ active: topicId === t.id }"
            @click="pickTopic(t.id)"
          ><i class="topic-dot"></i><span class="topic-name-text">{{ t.name }}</span><span class="topic-enter" title="进入话题页" @click.stop="router.push(`/topic/${t.id}`)">›</span></span>
        </nav>
      </div>
    </aside>

    <!-- ============ 中栏：主信息流 ============ -->
    <section class="home-main">
      <!-- 应用场景卷首（静态，诗句已在首屏展示过） -->
      <header class="scene-heading">
        <span class="scene-mark">卷</span>
        <div class="scene-heading-text">
          <span class="scene-title">尘间卷帙</span>
          <span class="scene-sub">且将浮生事，说与晚风听</span>
        </div>
        <div class="ornament scene-ornament"><span class="ornament-diamond"></span></div>
      </header>

      <!-- 工具条：搜索 + 篇数 + 排序（话题已移入左栏） -->
      <div class="main-toolbar">
        <form class="search-bar" @submit.prevent="doSearch">
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input
            v-model="keywordInput"
            class="search-input"
            type="text"
            placeholder="寻标题 · 正文 · 地点"
            aria-label="搜索动态"
          />
          <button v-if="keywordInput" type="button" class="search-clear" @click="clearSearch" title="清除搜索">×</button>
          <button type="submit" class="search-submit">搜</button>
        </form>
        <div class="toolbar-right">
          <span class="toolbar-count">{{ keyword ? `“${keyword}” · ${total} 篇` : `共 ${total} 篇` }}</span>
          <div class="sort-group">
            <span
              class="sort-item"
              :class="{ active: sort === 'new' }"
              @click="pickSort('new')"
            >最新</span>
            <span
              class="sort-item"
              :class="{ active: sort === 'hot' }"
              @click="pickSort('hot')"
            >热度</span>
          </div>
        </div>
      </div>

      <!-- 卡片列表 -->
      <div class="card-list" v-loading="loading">
        <div
          v-for="(m, idx) in moments"
          :key="m.id"
          class="moment-card nr-card nr-glow card-enter"
          :style="{ animationDelay: Math.min(idx, 8) * 0.08 + 's' }"
          @click="router.push(`/detail/${m.id}`)"
        >
          <!-- 序号：壹/贰…的极淡角标 -->
          <span class="card-index">{{ idx + 1 < 10 ? '0' + (idx + 1) : idx + 1 }}</span>

          <!-- 作者：头像 + 昵称 + 时间（点进 TA 的照片墙） -->
          <div class="moment-author author-link" :title="'看看 ' + (m.nickname || 'TA') + ' 的主页'" @click.stop="goWall(m.userId)">
            <span class="avatar-ring">
              <img class="avatar" :src="imgUrl(m.avatar)" alt="avatar" />
            </span>
            <div class="author-info">
              <span class="nickname">{{ m.nickname }}</span>
              <span class="author-time">{{ formatTime(m.createTime) }}</span>
            </div>
          </div>

          <!-- 标题 -->
          <h2 class="moment-title" v-if="m.title">{{ m.title }}</h2>

          <!-- 内容 -->
          <p class="moment-content">{{ m.content }}</p>

          <!-- 图片九宫格（按数量自适应，始终铺满无空缺） -->
          <div class="moment-images" :class="'imgs-' + Math.min(m.images?.length || 0, 9)" v-if="m.images?.length">
            <img
              v-for="(img, i) in m.images"
              :key="i"
              class="grid-img"
              :src="imgUrl(img)"
              :alt="m.title"
              @click.stop="preview(m, i)"
            />
          </div>

          <!-- 地点 / 心情 + 点赞 / 评论 / 收藏数 -->
          <div class="moment-meta">
            <span v-if="m.location" class="meta-chip">📍 {{ m.location }}</span>
            <span v-if="m.mood" class="meta-chip">心情 · {{ m.mood }}</span>
            <span class="meta-stats">
              <LikeButton :targetId="m.id" :targetType="1" :initial="m.likeCount ?? 0" />
              <span>✎ {{ m.commentCount ?? 0 }}</span>
              <CollectButton :momentId="m.id" :initial="m.collectCount ?? 0" />
            </span>
          </div>
        </div>

        <!-- 加载更多 -->
        <div class="load-more" v-if="hasMore && !loading">
          <el-button @click="loadMore">载入更多</el-button>
        </div>

        <!-- 空状态 -->
        <div v-if="!loading && moments.length === 0" class="empty">
          <span class="seal empty-seal">空</span>
          <p class="empty-title">{{ keyword ? '未寻得相关故事' : '此处尚无故事' }}</p>
          <p class="empty-sub">{{ keyword ? '换个关键词，或清除搜索再看看' : '去发布第一条图文，落笔成叙' }}</p>
          <button v-if="keyword" class="empty-clear" @click="clearSearch">清除搜索</button>
        </div>
      </div>
    </section>

    <!-- ============ 右栏：风华榜 ============ -->
    <aside class="home-aside aside-right">
      <!-- 热度榜 -->
      <div class="side-card rank-card">
        <div class="side-heading"><span>风 华 榜</span></div>
        <p class="rank-sub">点赞 ×2 · 评论 ×3 · 收藏 ×1</p>
        <div v-if="hotMoments.length" class="rank-list">
          <div
            v-for="(h, i) in hotMoments"
            :key="h.id"
            class="rank-item"
            @click="router.push(`/detail/${h.id}`)"
          >
            <span class="rank-no" :class="{ top: i < 3, first: i === 0 }">{{ rankLabel[i] }}</span>
            <div class="rank-info">
              <span class="rank-title">{{ h.title || h.content }}</span>
              <span class="rank-meta">{{ h.nickname || '过客' }} · 热度 {{ hotScore(h) }}</span>
              <span class="rank-bar"><i :style="{ width: rankWidth(h) }"></i></span>
            </div>
          </div>
        </div>
        <div v-else class="rank-empty">榜单待续</div>
      </div>

      <!-- 站点闲章 -->
      <div class="side-card about-card">
        <span class="seal seal-sm about-seal">叙</span>
        <p class="about-line">一卷一世界</p>
        <p class="about-line">一叙一尘缘</p>
        <div class="ornament about-ornament"><span class="ornament-diamond"></span></div>
        <p class="about-foot">尘叙阁 · 卷帙</p>
      </div>
    </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import LikeButton from '../components/LikeButton.vue'
import CollectButton from '../components/CollectButton.vue'
import { useVerseTyper } from '../utils/useVerseTyper'

const router = useRouter()

/* ---------------- 首屏入场：粒子 + 视频 + 向下探索 ---------------- */
const entryVideo = ref(null)
const heroSection = ref(null)
const particleCanvas = ref(null)
const sceneRef = ref(null)
let entryObserver = null

// 向下探索：平滑滚动进入正式应用场景
function scrollToScene() {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  sceneRef.value?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}
// 回到顶部
function scrollToTop() {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}

/* ---------------- 星尘 / 萤火粒子系统（Canvas，离屏暂停） ----------------
   纯 2D 圆点 + 少量流星线，走 requestAnimationFrame；
   数量按屏幕面积自适应并设上限，离开首屏即停帧，避免常驻耗电。 */
let particleRaf = null
let particleRunning = false
let meteorTimer = null
let onParticleResize = null

function initParticles() {
  const canvas = particleCanvas.value
  if (!canvas || !canvas.getContext) return
  const ctx = canvas.getContext('2d')
  let w = 0, h = 0, dpr = 1
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const GOLD = '238, 226, 190' // 粒子用更亮的暖金，暗背景上更显星尘感

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  onParticleResize = resize
  window.addEventListener('resize', resize)

  // 星尘粒子：少量缓升光点，透明度和半径各异
  const count = reduce ? 30 : Math.min(120, Math.max(45, Math.round((w * h) / 15000)))
  const dust = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.7 + 0.6,
    vy: -(Math.random() * 0.22 + 0.06),
    drift: (Math.random() - 0.5) * 0.18,
    base: Math.random() * 0.55 + 0.4,
    twinkle: Math.random() * 0.02 + 0.006,
    phase: Math.random() * Math.PI * 2,
    sparkle: Math.random() < 0.12,
  }))

  // 流星：偶发，从右上划向左下
  let meteor = null
  function spawnMeteor() {
    meteor = {
      x: w * (0.45 + Math.random() * 0.5),
      y: -30,
      speed: 7 + Math.random() * 4,
      life: 1,
    }
  }
  if (!reduce) {
    meteorTimer = window.setInterval(() => {
      if (particleRunning && !meteor && Math.random() > 0.45) spawnMeteor()
    }, 2600)
  }

  function draw() {
    if (!particleRunning) return
    ctx.clearRect(0, 0, w, h)

    for (const p of dust) {
      p.y += p.vy
      p.x += p.drift
      p.phase += p.twinkle
      const alpha = p.base * (0.65 + 0.35 * Math.sin(p.phase))
      if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w }
      // 少数亮星带十字光芒
      if (p.sparkle) {
        const arm = p.r * 3.4 * (0.7 + 0.3 * Math.sin(p.phase))
        ctx.strokeStyle = `rgba(${GOLD}, ${alpha * 0.55})`
        ctx.lineWidth = 0.7
        ctx.beginPath()
        ctx.moveTo(p.x - arm, p.y); ctx.lineTo(p.x + arm, p.y)
        ctx.moveTo(p.x, p.y - arm); ctx.lineTo(p.x, p.y + arm)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${GOLD}, ${alpha})`
      ctx.fill()
    }

    if (meteor) {
      const g = ctx.createLinearGradient(meteor.x, meteor.y, meteor.x - 120, meteor.y + 120)
      g.addColorStop(0, `rgba(${GOLD}, 0.85)`)
      g.addColorStop(1, `rgba(${GOLD}, 0)`)
      ctx.strokeStyle = g
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(meteor.x, meteor.y)
      ctx.lineTo(meteor.x - 120, meteor.y + 120)
      ctx.stroke()
      meteor.x -= meteor.speed * 0.7
      meteor.y += meteor.speed
      meteor.life -= 0.006
      if (meteor.life <= 0 || meteor.y > h + 100) meteor = null
    }
    particleRaf = requestAnimationFrame(draw)
  }

  return {
    start() {
      if (particleRunning) return
      particleRunning = true
      draw()
    },
    stop() {
      particleRunning = false
      if (particleRaf) { cancelAnimationFrame(particleRaf); particleRaf = null }
    },
  }
}
let particles = null

/* ---------------- 标题诗句轮播（打字机） ---------------- */
const { typed: typedVerse } = useVerseTyper()

/* ---------------- 筛选状态 ---------------- */
const topicId = ref(0)
const sort = ref('new')
const topics = ref([])

/* ---------------- 搜索状态 ---------------- */
const keywordInput = ref('')   // 输入框绑定值
const keyword = ref('')        // 当前生效的搜索词（空 = 普通列表）

/* ---------------- 分页状态 ---------------- */
const moments = ref([])
const loading = ref(false)
const page = ref(1)
const size = 10
const hasMore = ref(false)
const total = ref(0)

/* ---------------- 风华榜（热度 Top5） ---------------- */
const hotMoments = ref([])
const rankLabel = ['壹', '贰', '叁', '肆', '伍']
function hotScore(m) {
  return (m.likeCount ?? 0) * 2 + (m.commentCount ?? 0) * 3 + (m.collectCount ?? 0)
}
// 热度条宽度：相对榜单最高分归一化（最高 100%，最低保留 12% 可见）
function rankWidth(m) {
  const scores = hotMoments.value.map(hotScore)
  const max = Math.max(...scores, 1)
  const cur = hotScore(m)
  return Math.max(12, Math.round((cur / max) * 100)) + '%'
}

/* ---------------- 请求话题列表：GET /topics ---------------- */
async function fetchTopics() {
  try {
    const res = await axios.get('/topics')
    topics.value = res.data.data ?? []
  } catch (err) {
    // 错误提示由 main.js 的响应拦截器统一弹出
  }
}

/* ---------------- 请求风华榜：GET /moments/list?sort=hot ---------------- */
async function fetchHot() {
  try {
    const res = await axios.get('/moments/list', { params: { page: 1, size: 5, sort: 'hot' } })
    hotMoments.value = (res.data.data?.records ?? []).slice(0, 5)
  } catch (err) {
    // 错误提示由 main.js 的响应拦截器统一弹出
  }
}

/* ---------------- 请求信息流：搜索时 /moments/search，否则 /moments/list ---------------- */
async function fetchList() {
  loading.value = true
  try {
    const params = { page: 1, size, sort: sort.value }
    if (keyword.value) {
      // 搜索模式：按关键词匹配标题/正文/地点
      params.keyword = keyword.value
      const res = await axios.get('/moments/search', { params })
      applyListData(res.data.data ?? {})
    } else {
      if (topicId.value) params.topicId = topicId.value
      const res = await axios.get('/moments/list', { params })
      applyListData(res.data.data ?? {})
    }
  } catch (err) {
    // 错误提示由 main.js 的响应拦截器统一弹出
  } finally {
    loading.value = false
  }
}

// 把分页结果写入列表状态
function applyListData(data) {
  moments.value = data.records ?? []
  total.value = data.total ?? 0
  hasMore.value = data.current < data.pages
}

// 加载更多
async function loadMore() {
  const next = page.value + 1
  try {
    const params = { page: next, size, sort: sort.value }
    if (keyword.value) {
      params.keyword = keyword.value
    } else if (topicId.value) {
      params.topicId = topicId.value
    }
    const url = keyword.value ? '/moments/search' : '/moments/list'
    const res = await axios.get(url, { params })
    const data = res.data.data ?? {}
    moments.value = [...moments.value, ...(data.records ?? [])]
    page.value = next
    hasMore.value = data.current < data.pages
  } catch (err) {
    // 错误提示由 main.js 的响应拦截器统一弹出
  }
}

/* ---------------- 搜索交互 ---------------- */
function doSearch() {
  const kw = keywordInput.value.trim()
  if (!kw) {
    // 空关键词：视为清除搜索，恢复普通列表
    clearSearch()
    return
  }
  keyword.value = kw
  topicId.value = 0   // 搜索时重置话题筛选，避免条件混淆
  page.value = 1
  switchFilterThenFetch()
}

function clearSearch() {
  keywordInput.value = ''
  if (!keyword.value) return
  keyword.value = ''
  page.value = 1
  switchFilterThenFetch()
}

/* ---------------- 筛选切换 ---------------- */
let filterScrollTimer = null

function pickTopic(id) {
  const wasSearching = !!keyword.value
  // 点话题先退出搜索模式，恢复按话题浏览
  if (wasSearching) {
    keyword.value = ''
    keywordInput.value = ''
  }
  if (!wasSearching && topicId.value === id) return
  topicId.value = id
  page.value = 1
  switchFilterThenFetch()
}

function pickSort(s) {
  if (sort.value === s) return
  sort.value = s
  page.value = 1
  switchFilterThenFetch()
}

// 切换话题/排序：先平滑回到列表卷首，滚动到位后再换数据。
// 原理：筛选后卡片可能变少、页面高度骤降，若此刻停在页面下方，
// 浏览器会把 scrollY 强行 clamp 到新高度上限，表现为「界面跳动」。
// 关键顺序——必须先滚、后换数据：滚动期间旧列表仍在、高度不变，
// 平滑动画能完整走完；若边滚边换，骤降的高度会立刻打断动画并 clamp。
function switchFilterThenFetch() {
  if (filterScrollTimer) clearTimeout(filterScrollTimer)
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const targetTop = sceneRef.value
    ? Math.max(0, sceneRef.value.getBoundingClientRect().top + window.scrollY - 84)
    : 0
  const dist = Math.abs(window.scrollY - targetTop)
  // 已在顶部附近 / 尊重减少动画：直接换数据
  if (reduce || dist < 30) {
    fetchList()
    return
  }
  window.scrollTo({ top: targetTop, behavior: 'smooth' })
  // 平滑滚动时长随距离变化，等到位后再换数据（留出少量余量）
  const wait = Math.min(700, 220 + dist * 0.55)
  filterScrollTimer = setTimeout(() => {
    filterScrollTimer = null
    fetchList()
  }, wait)
}

/* ---------------- 图片地址处理 ---------------- */
// 后端返回相对路径（形如 /images/xxx.png），拼上 baseURL；已是完整 URL 则直接使用
function imgUrl(img) {
  if (!img) return ''
  if (img.startsWith('http') || img.startsWith('//')) return img
  return 'http://localhost:8080' + (img.startsWith('/') ? img : '/' + img)
}

// 图片点击：简单预览（新窗口打开原图）
function preview(card, i) {
  window.open(imgUrl(card.images?.[i]), '_blank')
}

/* ---------------- 进入作者主页 ---------------- */
function goWall(userId) {
  if (userId == null) return
  router.push(`/profile/${userId}`)
}

/* ---------------- 时间格式化 ---------------- */
function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t)
  const p = (n) => (n < 10 ? '0' + n : n)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`
}

/* ---------------- 生命周期 ---------------- */
onMounted(() => {
  fetchTopics()
  fetchList()
  fetchHot()

  // 粒子系统
  particles = initParticles()
  particles?.start()

  // 入场区滚出视口后：暂停视频解码 + 粒子停帧 + 停止诗句打字机与流字动画；
  // 滚回来再恢复。让下方应用场景的滚动完全零入场动画开销。
  const heroEl = heroSection.value
  const v = entryVideo.value
  if (heroEl && 'IntersectionObserver' in window) {
    entryObserver = new IntersectionObserver(
      ([entry]) => {
        heroEl.classList.toggle('entry-paused', !entry.isIntersecting)
        if (entry.isIntersecting) {
          v?.play().catch(() => {})
          particles?.start()
        } else {
          v?.pause()
          particles?.stop()
        }
      },
      // 顶部排除 90px（导航+scroll-margin），入场区只剩顶部一条时即视为离开
      { threshold: 0.05, rootMargin: '-90px 0px 0px 0px' }
    )
    entryObserver.observe(heroEl)
  }
})
onBeforeUnmount(() => {
  entryObserver?.disconnect()
  entryObserver = null
  particles?.stop()
  particles = null
  if (meteorTimer) { clearInterval(meteorTimer); meteorTimer = null }
  if (onParticleResize) { window.removeEventListener('resize', onParticleResize); onParticleResize = null }
})
</script>

<style scoped>
/* ==================== 首屏入场：视频 + 流动诗句 ==================== */
.home-wrap { position: relative; }

.entry-hero {
  position: relative;
  height: 100vh;
  min-height: 560px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.entry-video-wrap {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}
.entry-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(100%) brightness(0.42);
  transform: translateZ(0);
}
.entry-video-mask {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 75% at 42% 48%, rgba(6, 12, 14, 0.42) 0%, rgba(4, 7, 10, 0.82) 100%),
    linear-gradient(90deg, rgba(6, 9, 12, 0.72) 0%, rgba(6, 9, 12, 0.25) 55%, rgba(6, 9, 12, 0.55) 100%),
    linear-gradient(to bottom, rgba(10, 12, 16, 0.3) 0%, transparent 25%, transparent 70%, #0a0a0a 100%);
}
/* 粒子层：覆盖首屏，不拦截鼠标 */
.entry-particles {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* 左右分栏内容区 */
.entry-inner {
  position: relative;
  z-index: 2;
  width: min(1200px, calc(100% - 96px));
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  align-items: center;
  gap: clamp(40px, 6vw, 96px);
}

/* 左：品牌文字 */
.entry-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  animation: fadeInRight 1.1s ease-out both;
}
.entry-greeting {
  font-size: 13px;
  letter-spacing: 0.4em;
  color: var(--c-gold-dim);
  margin-bottom: 14px;
}
.entry-copy .entry-title {
  font-family: var(--font-brush);
  font-size: clamp(64px, 8vw, 108px);
  font-weight: 400;
  letter-spacing: 0.1em;
  line-height: 1.05;
  text-shadow: 0 6px 40px rgba(0, 0, 0, 0.9);
  animation: textFlow 6s linear infinite;
}
.entry-en {
  margin-top: 8px;
  font-size: clamp(10px, 1.2vw, 13px);
  letter-spacing: 0.55em;
  color: var(--c-gold-dim);
}
.entry-role {
  display: inline-block;
  margin-top: 26px;
  padding: 7px 16px;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--c-gold);
  border: 1px solid var(--c-gold-faint);
  border-radius: 999px;
  background: rgba(222, 217, 203, 0.05);
}
.entry-desc {
  margin-top: 22px;
  font-size: clamp(14px, 1.3vw, 16px);
  line-height: 2;
  letter-spacing: 0.08em;
  color: rgba(244, 247, 251, 0.9);
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.85);
}
.entry-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 34px;
}
.entry-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 132px;
  padding: 12px 26px;
  font-size: 14px;
  letter-spacing: 0.16em;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.25s ease, background 0.25s ease, color 0.25s ease, box-shadow 0.25s ease;
  text-decoration: none;
}
.entry-btn:hover { transform: translateY(-2px); }
.entry-btn-primary {
  color: #14120e;
  background: var(--c-gold);
  border: 1px solid var(--c-gold);
  box-shadow: 0 6px 24px rgba(222, 217, 203, 0.18);
}
.entry-btn-primary:hover { box-shadow: 0 10px 30px rgba(222, 217, 203, 0.32); }
.entry-btn-ghost {
  color: var(--c-gold);
  background: rgba(222, 217, 203, 0.04);
  border: 1px solid var(--c-gold-faint);
}
.entry-btn-ghost:hover { background: rgba(222, 217, 203, 0.12); border-color: var(--c-gold-dim); }

/* 右：毛玻璃诗句卡片 */
.entry-glass {
  position: relative;
  justify-self: end;
  width: min(100%, 440px);
  min-height: 340px;
  padding: 54px 44px 40px;
  border-radius: 10px;
  border: 1px solid rgba(222, 217, 203, 0.16);
  background: rgba(18, 22, 27, 0.42);
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  animation: fadeInLeft 1.1s ease-out 0.15s both;
}
.glass-mark {
  position: absolute;
  top: 10px;
  left: 34px;
  font-family: Georgia, serif;
  font-size: 92px;
  line-height: 1;
  color: rgba(222, 217, 203, 0.16);
}
.glass-verse {
  position: relative;
  font-family: var(--font-brush);
  font-size: clamp(24px, 2.6vw, 34px);
  line-height: 1.9;
  letter-spacing: 0.1em;
  color: #f5f5f5;
  min-height: 3.8em;
  text-shadow: 0 3px 16px rgba(0, 0, 0, 0.5);
}
.glass-verse .type-cursor { background: var(--c-gold); height: 0.85em; }
.glass-sign {
  margin-top: 26px;
  text-align: right;
  font-family: var(--font-brush);
  font-size: 16px;
  letter-spacing: 0.1em;
  color: var(--c-gold-dim);
}

/* 向下探索提示 */
.entry-scroll {
  position: absolute;
  bottom: 40px;
  left: 0;
  right: 0;
  z-index: 2;
  margin: 0 auto;
  width: fit-content;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: rgba(232, 217, 181, 0.65);
  transition: color 0.3s ease;
  animation: fadeInUp 1.2s ease-out 0.9s both;
}
.entry-scroll:hover { color: var(--c-gold); }
.entry-scroll-text { font-size: 12px; letter-spacing: 0.35em; text-indent: 0.35em; }
.entry-scroll-arrow { font-size: 24px; line-height: 1; animation: arrowBounce 2s ease-in-out infinite; }

/* 右下悬浮工具栏 */
.entry-float {
  position: absolute;
  right: 30px;
  bottom: 118px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.float-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(222, 217, 203, 0.22);
  background: rgba(18, 22, 27, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--c-gold);
  cursor: pointer;
  transition: background 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
  text-decoration: none;
}
.float-btn:hover { background: rgba(222, 217, 203, 0.14); border-color: var(--c-gold-dim); transform: translateY(-2px); }
.float-ico { font-size: 18px; line-height: 1; }

/* 入场区滚出视口后：暂停其所有 CSS 动画，应用场景滚动零开销 */
.entry-hero.entry-paused .entry-title,
.entry-hero.entry-paused .entry-scroll-arrow,
.entry-hero.entry-paused .type-cursor { animation-play-state: paused !important; }
@keyframes fadeInRight {
  from { opacity: 0; transform: translateX(-26px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes fadeInLeft {
  from { opacity: 0; transform: translateX(26px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes arrowBounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(9px); }
}

/* ==================== 三栏杂志布局 ==================== */
.home {
  /* 贴近屏幕两侧：容器随视口展开，仅在超宽屏上限 1680px；四周留 32px 呼吸 */
  max-width: min(1680px, calc(100% - 64px));
  margin: 0 auto;
  padding: 32px 0 80px;
  scroll-margin-top: 84px; /* 向下探索定位时为固定导航留出空间 */
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 280px;
  grid-template-areas: 'left main right';
  gap: 20px;
  align-items: start;
}
.home-aside {
  position: sticky;
  top: 96px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.aside-left { grid-area: left; }
.home-main {
  grid-area: main;
  min-width: 0;
  width: 100%;
  max-width: 920px; /* 中栏尽量填满网格单元，缩短与左右栏的间隔 */
  margin: 0 auto;   /* 在中栏网格单元内居中，使左右间距视觉对称 */
}
.aside-right { grid-area: right; }

/* ---------- 侧栏通用卡片（实色背景，无逐帧毛玻璃开销） ---------- */
.side-card {
  background: var(--card-bg-solid);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  padding: 22px 20px;
  transition: border-color 0.25s ease, transform 0.3s ease;
}
.side-card:hover { transform: translateY(-2px); }
.side-card:hover { border-color: var(--card-border-hover); }
.side-heading {
  font-family: var(--font-brush);
  font-size: 16px;
  letter-spacing: 4px;
  color: var(--c-gold);
  text-align: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--c-gold-faint);
}

/* ---------- 左栏：卷首小引 ---------- */
.intro-card { text-align: center; padding: 26px 18px 22px; }
.intro-seal { margin: 0 auto 14px; }
.intro-name {
  font-family: var(--font-brush);
  font-size: 24px;
  font-weight: 400;
  letter-spacing: 5px;
  color: var(--nr-white);
}
.intro-en {
  margin-top: 6px;
  font-size: 8px;
  letter-spacing: 2px;
  color: var(--c-gold-dim);
  text-transform: uppercase;
}
.intro-ornament { margin: 16px auto; opacity: 0.55; }
.intro-ornament::before,
.intro-ornament::after { width: 28px; }
.intro-verse {
  font-family: var(--font-brush);
  font-size: 15px;
  line-height: 2;
  letter-spacing: 3px;
  color: var(--txt-2);
}
.pub-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
  padding: 9px 0;
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--c-gold);
  text-decoration: none;
  border: 1px solid var(--c-gold-dim);
  border-radius: var(--radius-ctrl);
  background: rgba(222, 217, 203, 0.05);
  transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}
.pub-link:hover {
  background: rgba(222, 217, 203, 0.12);
  border-color: var(--c-gold);
  box-shadow: 0 0 18px rgba(222, 217, 203, 0.14);
}
.pub-arrow { font-size: 14px; transition: transform 0.25s ease; }
.pub-link:hover .pub-arrow { transform: translateX(3px); }

/* ---------- 左栏：主题卷目（话题导航） ---------- */
.topic-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 10px;
}
.topic-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--txt-2);
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: color 0.25s ease, background 0.25s ease, border-color 0.25s ease;
  user-select: none;
}
.topic-item:hover {
  color: var(--txt-1);
  background: rgba(255, 255, 255, 0.03);
}
.topic-item.active {
  color: var(--c-gold);
  border-left-color: var(--c-gold);
  background: rgba(232, 217, 181, 0.07);
}
.topic-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--txt-3);
  transition: background 0.25s ease, box-shadow 0.25s ease;
  flex: none;
}
.topic-item.active .topic-dot {
  background: var(--c-gold);
  box-shadow: 0 0 8px rgba(232, 217, 181, 0.5);
}
.topic-name-text { flex: 1; min-width: 0; }
.topic-enter {
  flex: none;
  font-size: 17px;
  line-height: 1;
  color: var(--txt-3);
  opacity: 0;
  transition: opacity .2s, color .2s;
}
.topic-item:hover .topic-enter { opacity: 1; }
.topic-enter:hover { color: var(--c-gold); }

/* ---------- 中栏：应用场景卷首（静态，避免重复动画与开销） ----------
   与左右栏顶部卡片采用同一套方框语言，使三栏顶部齐整贴合 */
.scene-heading {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 22px;
  margin-bottom: 22px;
  background: var(--card-bg-solid);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  transition: border-color 0.25s ease;
}
.scene-heading:hover { border-color: var(--card-border-hover); }
.scene-mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: none;
  font-family: var(--font-brush);
  font-size: 22px;
  color: var(--c-gold);
  border: 1px solid var(--c-gold-dim);
  border-radius: var(--radius-sm);
  background: rgba(222, 217, 203, 0.06);
}
.scene-heading-text { display: flex; flex-direction: column; gap: 4px; }
.scene-title {
  font-family: var(--font-brush);
  font-size: 24px;
  letter-spacing: 4px;
  color: #f5f5f5;
}
.scene-sub {
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--txt-3);
}
.scene-ornament { margin-left: auto; opacity: 0.5; }
.scene-ornament::before, .scene-ornament::after { width: 22px; }

/* ---------- 中栏：工具条 ---------- */
.main-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 4px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--c-gold-faint);
}
.toolbar-right { display: flex; align-items: center; gap: 14px; }
.toolbar-count {
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--txt-2);
  white-space: nowrap;
}
.toolbar-count::before {
  content: '卷 · ';
  color: var(--c-gold-dim);
}

/* 搜索框 */
.search-bar {
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 360px;
  height: 36px;
  padding: 0 4px 0 12px;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-ctrl);
  background: rgba(10, 13, 18, 0.4);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.search-bar:focus-within {
  border-color: var(--c-gold-dim);
  box-shadow: 0 0 16px rgba(222, 217, 203, 0.08);
}
.search-icon {
  font-size: 18px;
  line-height: 1;
  color: var(--c-gold-dim);
  margin-right: 8px;
  flex: none;
}
.search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--txt-1);
  font-family: var(--font-body);
  font-size: 13px;
  letter-spacing: 1px;
}
.search-input::placeholder { color: var(--txt-3); }
.search-clear {
  flex: none;
  border: none;
  background: transparent;
  color: var(--txt-3);
  font-size: 18px;
  line-height: 1;
  padding: 0 6px;
  cursor: pointer;
  transition: color 0.2s ease;
}
.search-clear:hover { color: var(--txt-1); }
.search-submit {
  flex: none;
  height: 28px;
  min-width: 34px;
  padding: 0 10px;
  border: 1px solid var(--c-gold-dim);
  border-radius: var(--radius-sm);
  background: rgba(222, 217, 203, 0.08);
  color: var(--c-gold);
  font-family: var(--font-brush);
  font-size: 15px;
  cursor: pointer;
  transition: background 0.25s ease, box-shadow 0.25s ease;
}
.search-submit:hover {
  background: rgba(222, 217, 203, 0.18);
  box-shadow: 0 0 14px rgba(222, 217, 203, 0.15);
}
.sort-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-ctrl);
  background: rgba(10, 13, 18, 0.4);
}
.sort-item {
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--txt-3);
  cursor: pointer;
  padding: 5px 16px;
  border-radius: var(--radius-sm);
  transition: color 0.25s ease, background 0.25s ease;
  user-select: none;
}
.sort-item:hover { color: var(--txt-1); }
.sort-item.active {
  color: #14171c;
  background: var(--c-gold);
  box-shadow: 0 2px 12px rgba(222, 217, 203, 0.2);
}

/* 卡片列表：设最小高度，避免少内容/空结果时页面骤然变矮、
   滚动位置被浏览器 clamp 造成界面跳动 */
.card-list { min-height: calc(100vh - 320px); }

/* 卡片错落入场 */
.card-enter { animation: fadeInUp 0.7s ease-out both; }

/* ---------- 中栏：图文卡片 ---------- */
.moment-card {
  position: relative;
  padding: 26px 28px;
  margin-bottom: 18px;
  cursor: pointer;
}
.moment-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 26px;
  height: 30px;
  width: 2px;
  background: linear-gradient(to bottom, var(--c-gold), transparent);
  transition: height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.moment-card:hover::before { height: calc(100% - 52px); }
.card-index {
  position: absolute;
  top: 18px;
  right: 24px;
  font-family: var(--font-brush);
  font-size: 20px;
  color: var(--c-gold-faint);
  line-height: 1;
  transition: color 0.3s ease;
}
.moment-card:hover .card-index { color: var(--c-gold-dim); }

.moment-author {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 0 40px 14px 0;
  border-bottom: 1px solid var(--c-gold-faint);
}
.author-link { cursor: pointer; transition: opacity 0.25s ease; }
.author-link:hover .nickname { color: var(--c-gold); }
.author-link:hover .avatar-ring { background: linear-gradient(135deg, var(--c-gold), rgba(222, 217, 203, 0.2)); }
.avatar-ring {
  display: inline-flex;
  padding: 2px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c-gold-dim), rgba(222, 217, 203, 0.06));
  flex: none;
}
.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #0a0a0a;
  background: rgba(255, 255, 255, 0.05);
}
.author-info { display: flex; flex-direction: column; line-height: 1.5; }
.nickname { font-size: 15px; letter-spacing: 1px; color: var(--txt-1); }
.author-time { font-size: 12px; letter-spacing: 1px; color: var(--txt-3); }

.moment-title {
  font-size: 19px;
  font-weight: 500;
  letter-spacing: 2px;
  color: #f5f5f5;
  margin-bottom: 10px;
}
.moment-content {
  font-size: 14px;
  line-height: 1.9;
  letter-spacing: 1px;
  color: var(--txt-2);
  white-space: pre-wrap;
}

/* 图片九宫格：6 列弹性网格，配合均分 span 让任意张数都铺满、无右侧空缺
   1 张→占满 6 列；2 张→各占 3 列；3 张→首张 6 列 + 后两张各 3 列；
   4 张→各占 3 列(2×2)；5~9 张→各占 2 列(3 列网格) */
.moment-images {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  margin-top: 14px;
}
.grid-img {
  width: 100%;
  grid-column: span 2;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid rgba(216, 226, 240, 0.08);
  /* 去掉逐图 filter（8 张图=8 个滤镜层）；压暗交给容器叠加层 */
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.4s ease;
}
.grid-img:hover {
  transform: scale(1.035);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6);
  position: relative;
  z-index: 1;
}
/* 1 张：单张大图 */
.imgs-1 .grid-img { grid-column: span 6; aspect-ratio: 16 / 9; }
/* 2 张：左右各半 */
.imgs-2 .grid-img { grid-column: span 3; aspect-ratio: 4 / 3; }
/* 3 张：首张通栏大图 + 下方两张各半 */
.imgs-3 .grid-img:first-child { grid-column: span 6; aspect-ratio: 16 / 9; }
.imgs-3 .grid-img:not(:first-child) { grid-column: span 3; aspect-ratio: 4 / 3; }
/* 4 张：2×2 */
.imgs-4 .grid-img { grid-column: span 3; aspect-ratio: 4 / 3; }

.moment-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--txt-3);
}
.meta-chip {
  padding: 4px 11px;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  background: rgba(220, 230, 244, 0.04);
}
.meta-stats {
  margin-left: auto;
  display: flex;
  gap: 14px;
  color: var(--txt-3);
}

.load-more { text-align: center; margin-top: 8px; }
.load-more :deep(.el-button) {
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--txt-2);
  letter-spacing: 3px;
}
.load-more :deep(.el-button:hover) {
  border-color: var(--card-border-hover);
  color: var(--txt-1);
}

.empty { text-align: center; padding: 60px 0; }
.empty-clear {
  margin-top: 18px;
  padding: 8px 22px;
  border: 1px solid var(--c-gold-dim);
  border-radius: var(--radius-ctrl);
  background: rgba(222, 217, 203, 0.06);
  color: var(--c-gold);
  font-family: var(--font-body);
  font-size: 13px;
  letter-spacing: 2px;
  cursor: pointer;
  transition: background 0.25s ease;
}
.empty-clear:hover { background: rgba(222, 217, 203, 0.16); }
.empty-seal { margin: 0 auto 22px; opacity: 0.6; }
.empty-title {
  font-family: var(--font-brush);
  font-size: 24px;
  letter-spacing: 6px;
  color: var(--txt-2);
}
.empty-sub {
  margin-top: 12px;
  font-size: 13px;
  letter-spacing: 4px;
  color: var(--txt-3);
}

/* ---------- 右栏：风华榜 ---------- */
.rank-sub {
  margin: 12px 0 6px;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--txt-3);
  text-align: center;
}
.rank-list { display: flex; flex-direction: column; margin-top: 6px; }
.rank-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 2px;
  border-bottom: 1px solid rgba(216, 226, 240, 0.07);
  cursor: pointer;
  transition: transform 0.2s ease;
}
.rank-item:last-child { border-bottom: none; }
.rank-item:hover { transform: translateX(3px); }
.rank-no {
  font-family: var(--font-brush);
  font-size: 18px;
  color: var(--txt-3);
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  text-align: center;
  flex: none;
}
.rank-no.top { color: var(--c-gold); }
.rank-no.first {
  color: #14171c;
  background: var(--c-gold);
  border-radius: var(--radius-sm);
  box-shadow: 0 2px 12px rgba(222, 217, 203, 0.28);
}
.rank-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.rank-title {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--txt-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rank-title::before { content: '「'; color: var(--c-gold-dim); }
.rank-title::after { content: '」'; color: var(--c-gold-dim); }
.rank-meta { font-size: 10px; letter-spacing: 1px; color: var(--txt-3); }
/* 热度条：细线随分数伸缩，让榜单高低一目了然 */
.rank-bar {
  display: block;
  height: 3px;
  margin-top: 3px;
  border-radius: 2px;
  background: rgba(216, 226, 240, 0.1);
  overflow: hidden;
}
.rank-bar i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--c-gold-dim), var(--c-gold));
  transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.rank-item:first-child .rank-bar i { box-shadow: 0 0 8px rgba(222, 217, 203, 0.45); }
.rank-empty {
  text-align: center;
  padding: 24px 0;
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--txt-3);
}

/* ---------- 右栏：站点闲章 ---------- */
.about-card { text-align: center; padding: 24px 18px; }
.about-seal { margin: 0 auto 14px; opacity: 0.8; }
.about-line {
  font-family: var(--font-brush);
  font-size: 15px;
  letter-spacing: 4px;
  line-height: 2;
  color: var(--txt-2);
}
.about-ornament { margin: 14px auto; opacity: 0.5; }
.about-ornament::before,
.about-ornament::after { width: 26px; }
.about-foot {
  margin-top: 12px;
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--c-gold-dim);
}

/* ==================== 响应式降级 ==================== */
/* 中屏：隐藏右栏，主栏 + 左栏两列 */
@media (max-width: 1040px) {
  .home {
    grid-template-columns: 180px minmax(0, 1fr);
    grid-template-areas: 'left main';
  }
  .aside-right { display: none; }
  /* 首屏两栏在中等宽度收窄间距 */
  .entry-inner {
    width: calc(100% - 64px);
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.85fr);
    gap: 34px;
  }
  .entry-glass { padding: 42px 32px 30px; min-height: 300px; }
}
/* 窄屏：单列，左栏卷首卡隐藏，话题导航转为横向条 */
@media (max-width: 760px) {
  .home {
    display: block;
    padding: 20px 14px 60px;
  }
  .home-aside { position: static; margin-bottom: 16px; }
  .intro-card { display: none; }
  .topic-card { padding: 8px 10px; }
  .side-heading { display: none; }
  .topic-nav {
    flex-direction: row;
    gap: 4px;
    margin-top: 0;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .topic-item {
    border-left: none;
    border-bottom: 2px solid transparent;
    padding: 8px 12px;
    white-space: nowrap;
  }
  .topic-item.active {
    border-left-color: transparent;
    border-bottom-color: var(--c-gold);
  }
  /* 入场 Hero 小屏适配：左右分栏堆叠为上下 */
  .entry-inner {
    width: calc(100% - 40px);
    grid-template-columns: 1fr;
    gap: 30px;
  }
  .entry-copy { align-items: flex-start; }
  .entry-copy .entry-title { font-size: 60px; }
  .entry-glass {
    justify-self: stretch;
    width: 100%;
    min-height: 0;
    padding: 44px 28px 30px;
  }
  .glass-verse { font-size: 24px; }
  .entry-float { right: 16px; bottom: 96px; }
  .entry-scroll { bottom: 26px; }
  .scene-title { font-size: 20px; }
  /* 工具条：搜索框独占一行，篇数与排序换行 */
  .main-toolbar { flex-wrap: wrap; gap: 10px; }
  .search-bar { max-width: none; flex-basis: 100%; }
  .toolbar-right { width: 100%; justify-content: space-between; }
}
/* 尊重减少动态效果 */
@media (prefers-reduced-motion: reduce) {
  .entry-copy, .entry-title, .entry-en, .entry-role,
  .entry-desc, .entry-actions, .entry-glass, .entry-scroll { animation: none !important; }
  .entry-scroll-arrow { animation: none !important; }
}
</style>
