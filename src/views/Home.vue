<!-- src/views/Home.vue —— 首页信息流（墨色玻璃 · 内容优先）
     ============================================================
     设计法则（全页只允许一种材质，这是「整」的前提）：
       · 背景：一张水墨图压暗，全站唯一一层
       · 卡片：同一种伪玻璃（半透明实色 + 1px 冷白边 + 顶部内高光）
       · 强调色：朱砂，只给可交互与关键数字，其余一律灰白
       · 圆角：卡片 10px，控件 6px，不再出现第三种
       · 字号：12 / 12.5 / 14 / 18 四档，行宽控制在 45–50 字
       · 纵向节奏：刊头 → 工具栏 → 内容，三条带，默认无第四条

     刻意没用 backdrop-filter：首页一屏十几张卡，真毛玻璃每帧都要采样
     背后内容，滚动必掉帧。这里用「半透明实色 + 内高光 + 细亮边」模拟，
     视觉上极接近，GPU 开销为零。
     ============================================================ -->
<template>
  <div class="ink-home">
    <div class="home-container">
      <!-- ==================== 刊头 ====================
           不再重复「尘叙阁」——导航里已经有站名，页头再写一遍会出现两个同级品牌名，
           看着像失误。这里只留一句卷首语 + 总量 + 主按钮，一行、34px 高。 -->
      <header class="masthead">
        <h1 class="mast-lead">把生活，写成一段可以翻阅的叙事</h1>
        <div class="mast-side">
          <span class="mast-count"><b>{{ allTotal }}</b> 篇叙事</span>
          <router-link to="/publish" class="mast-publish">写一段</router-link>
        </div>
      </header>

      <!-- ==================== 工具栏 ====================
           话题、朋友筛选、搜索、排序合并成一行。原来「只看朋友」单独占一行、
           右对齐，和左侧的数量文字不在同一基线，视觉上像遗留物。 -->
      <div class="toolbar" ref="toolbarRef">
        <nav class="chips" aria-label="话题筛选">
          <button class="chip" :class="{ on: !topicId && !friendOnly }" @click="pickTopic(0)">全部</button>
          <button
            v-for="t in topics"
            :key="t.id"
            class="chip"
            :class="{ on: topicId === t.id }"
            @click="pickTopic(t.id)"
          >{{ t.name }}</button>
        </nav>

        <span class="toolbar-gap" aria-hidden="true"></span>

        <button
          v-if="logged"
          class="chip chip-friend"
          :class="{ on: friendOnly }"
          @click="toggleFriendOnly"
        >只看朋友</button>

        <form class="search" @submit.prevent="doSearch">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" stroke-linecap="round" />
          </svg>
          <input
            v-model="keywordInput"
            class="search-input"
            type="text"
            placeholder="搜索标题 / 正文 / 地点"
            aria-label="搜索动态"
          />
          <button v-if="keywordInput" type="button" class="search-clear" @click="clearSearch" aria-label="清除">×</button>
        </form>
        <div class="seg" role="group" aria-label="排序">
          <button :class="{ on: sort === 'new' }" @click="pickSort('new')">最新</button>
          <button :class="{ on: sort === 'hot' }" @click="pickSort('hot')">热门</button>
        </div>
      </div>

      <!-- ==================== 筛选提示 ====================
           只在有筛选条件时出现。默认状态下这一行完全不存在，
           首屏因此少一条横带，第一条动态能再上提约 40px。 -->
      <div v-if="keyword || topicId || friendOnly" class="filter-note">
        <span class="filter-text">
          <template v-if="keyword">搜索 “{{ keyword }}”</template>
          <template v-else-if="friendOnly">只看朋友的动态</template>
          <template v-else>话题 · {{ currentTopicName }}</template>
          <em>{{ total }} 篇</em>
        </span>
        <button class="filter-reset" @click="resetFilters">清除筛选</button>
      </div>

      <!-- ==================== 主体 ==================== -->
      <div class="home-grid">
        <main class="feed" v-loading="loading">
          <!-- 就地发布：把「想写点什么」到「发出去」之间的成本压到最低。
               原来只能点导航/刊头的「写一段」跳整页填 5 个字段。 -->
          <PostComposer ref="composerRef" @posted="onPosted" />

          <!-- 卡片骨架见 <MomentCard variant="feed">：首条带图自动变左文右图，
               无标题无图的短句自动换成松排版。这里只管列表与分页。 -->
          <MomentCard
            v-for="(m, idx) in moments"
            :key="m.id"
            :moment="m"
            :featured="idx === 0"
          />

          <div v-if="hasMore && !loading" class="load-more">
            <button class="load-btn" @click="loadMore">载入更多</button>
          </div>

          <div v-if="!loading && moments.length === 0" class="empty">
            <p class="empty-title">{{ keyword ? '没有找到相关内容' : '这里还没有故事' }}</p>
            <p class="empty-desc">{{ keyword ? '换个关键词，或清除搜索再看看' : '发布第一条动态，从这里开始' }}</p>
            <button v-if="keyword" class="empty-btn" @click="clearSearch">清除搜索</button>
            <router-link v-else to="/publish" class="empty-btn">去发布</router-link>
          </div>
        </main>

        <!-- ==================== 侧栏 ====================
             原来只有一张热门卡，下面大半屏空白，右侧显得没做完。
             补一块「话题」——用的是 /topics 已有的真实数据，不是凑数。 -->
        <aside class="side">
          <section class="side-card">
            <h2 class="side-title">热门</h2>
            <ol v-if="hotMoments.length" class="hot-list">
              <li
                v-for="(h, i) in hotMoments"
                :key="h.id"
                class="hot-item"
                @click="router.push(`/detail/${h.id}`)"
              >
                <span class="hot-no" :class="{ top: i < 3 }">{{ i + 1 }}</span>
                <span class="hot-body">
                  <span class="hot-title">{{ h.title || h.content }}</span>
                  <span class="hot-meta">{{ h.nickname || '匿名' }} · {{ hotScore(h) }} 热度</span>
                </span>
              </li>
            </ol>
            <p v-else class="hot-empty">暂无内容</p>
          </section>

          <section v-if="topics.length" class="side-card">
            <h2 class="side-title">话题</h2>
            <ul class="topic-list">
              <li
                v-for="t in topics"
                :key="t.id"
                class="topic-item"
                :class="{ on: topicId === t.id }"
                @click="pickTopic(t.id)"
              >
                <span class="topic-name">{{ t.name }}</span>
                <span class="topic-desc">{{ t.description }}</span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>

    <!-- ==================== 右下角浮标：全页唯一「会动」的地方 ====================
         秒级刷新，但只在数字变化时才产生 DOM 更新；页面隐藏时浏览器会节流。
         刻意做得小：它的作用是让页面有呼吸，不是抢内容。 -->
    <div class="pulse" aria-hidden="true">
      <span class="pulse-time">{{ clock }}</span>
      <span class="pulse-sep"></span>
      <span class="pulse-txt">阁中已叙 {{ allTotal }} 篇</span>
    </div>

    <!-- 发布后的「入阁」确认卡：给归属（第 N 篇）、给产物（存成图）、给地址（复制链接） -->
    <PostedDialog
      v-model:visible="postedVisible"
      :content="postedContent"
      :moment-id="postedId"
      :seq="postedSeq"
      :nickname="myNickname"
      @again="onAgain"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import MomentCard from '../components/MomentCard.vue'
import PostComposer from '../components/PostComposer.vue'
import PostedDialog from '../components/PostedDialog.vue'
import { formatClock } from '../utils/format'

const router = useRouter()
const route = useRoute()

/* ---------------- 筛选状态 ---------------- */
const topicId = ref(0)
const sort = ref('new')
const topics = ref([])
const friendOnly = ref(false)
const logged = computed(() => !!localStorage.getItem('token'))

/* ---------------- 搜索 ---------------- */
const keywordInput = ref('')
const keyword = ref('')

/* ---------------- 分页 ---------------- */
const moments = ref([])
const loading = ref(false)
const page = ref(1)
const size = 10
const hasMore = ref(false)
const total = ref(0)
/* 全站总篇数：只在「无筛选」时更新，避免切换话题后页头数字跳变 */
const allTotal = ref(0)

/* ---------------- 热门榜 ---------------- */
const hotMoments = ref([])
function hotScore(m) {
  return (m.likeCount ?? 0) * 2 + (m.commentCount ?? 0) * 3 + (m.collectCount ?? 0)
}

/* ---------------- 就地发布 ---------------- */
const composerRef = ref(null)
const postedVisible = ref(false)
const postedContent = ref('')
const postedId = ref(null)
const postedSeq = ref(0)
const myNickname = ref(localStorage.getItem('nickname') || '')

/* 发布成功：先弹「入阁」确认卡，再刷新列表。
   顺序很重要 —— 若先刷新，v-loading 的遮罩会盖住弹窗出现的瞬间。 */
async function onPosted(p) {
  postedContent.value = p.content
  postedId.value = p.id
  postedSeq.value = p.total || (allTotal.value || 0) + 1
  postedVisible.value = true
  await fetchList()
  fetchHot()
}

/* 「再写一段」：把焦点交回就地输入框，而不是跳去发布页 */
function onAgain() {
  composerRef.value?.focus?.()
}

/* 短句卡（无标题、无图、50 字以内）的排版判断已经搬进 <MomentCard>，
   首页不再需要知道卡片长什么样。 */

/* ---------------- 右下角时钟 ---------------- */
const clock = ref('')
let clockTimer = null
function tick() {
  clock.value = formatClock()
}

/* ---------------- 列表滚动锚点 ---------------- */
const toolbarRef = ref(null)

async function fetchTopics() {
  try {
    const res = await axios.get('/topics')
    topics.value = res.data.data ?? []
  } catch (err) {
    // 提示由 main.js 的响应拦截器统一处理
  }
}

/* ---------------- 请求竞态守卫 ----------------
   连点 chip 时会有好几个 /moments/list 在路上，谁最后回来谁覆盖。
   网速不稳时就会出现「点美食，看到旅行」的串台。做法：每次换列表
   seq 自增，响应回来先对号，过期的直接丢，连 loading 也不还原。 */
let listSeq = 0
let hotSeq = 0

async function fetchHot() {
  const seq = ++hotSeq
  try {
    const res = await axios.get('/moments/list', { params: { page: 1, size: 5, sort: 'hot' } })
    if (seq !== hotSeq) return
    hotMoments.value = (res.data.data?.records ?? []).slice(0, 5)
  } catch (err) {
    // 同上
  }
}

/* 三种数据源：搜索 / 只看朋友 / 普通列表。
   分页也要复用同一套参数，抽出来一份，避免两处拼参数拼漏字段。 */
function requestMoments(pageNo) {
  if (keyword.value) {
    return axios
      .get('/moments/search', { params: { page: pageNo, size, sort: sort.value, keyword: keyword.value } })
      .then((res) => res.data.data ?? {})
  }
  if (friendOnly.value && logged.value) {
    return axios.get('/moments/friends', { params: { page: pageNo, size } }).then((res) => res.data.data ?? {})
  }
  const params = { page: pageNo, size, sort: sort.value }
  if (topicId.value) params.topicId = topicId.value
  return axios.get('/moments/list', { params }).then((res) => res.data.data ?? {})
}

async function fetchList() {
  const seq = ++listSeq
  loading.value = true
  try {
    const data = await requestMoments(1)
    if (seq !== listSeq) return
    applyListData(data)
  } catch (err) {
    // 同上
  } finally {
    if (seq === listSeq) loading.value = false
  }
}

function applyListData(data) {
  moments.value = data.records ?? []
  total.value = data.total ?? 0
  page.value = 1
  hasMore.value = data.current < data.pages
  if (!keyword.value && !topicId.value && !friendOnly.value) {
    allTotal.value = total.value
  }
}

const loadingMore = ref(false)
async function loadMore() {
  if (loadingMore.value) return
  // 注意这里不自增：这批属于「当前这一版列表」，中途若换了筛选条件
  // （listSeq 变了），追加进去的就是上一份列表的第 2 页，必须丢弃。
  const seq = listSeq
  const next = page.value + 1
  loadingMore.value = true
  try {
    const data = await requestMoments(next)
    if (seq !== listSeq) return
    moments.value = [...moments.value, ...(data.records ?? [])]
    page.value = next
    hasMore.value = data.current < data.pages
  } catch (err) {
    // 同上
  } finally {
    loadingMore.value = false
  }
}

/* ---------------- 交互 ---------------- */
/* 当前话题名：筛选提示行要用，找不到时退回空串（不显示“undefined”） */
const currentTopicName = computed(
  () => topics.value.find((t) => t.id === topicId.value)?.name ?? ''
)

function resetFilters() {
  keyword.value = ''
  keywordInput.value = ''
  friendOnly.value = false
  topicId.value = 0
  switchFilterThenFetch()
}

function toggleFriendOnly() {
  friendOnly.value = !friendOnly.value
  if (friendOnly.value) {
    keyword.value = ''
    keywordInput.value = ''
    topicId.value = 0
  }
  switchFilterThenFetch()
}

function doSearch() {
  const kw = keywordInput.value.trim()
  if (!kw) {
    clearSearch()
    return
  }
  keyword.value = kw
  topicId.value = 0
  switchFilterThenFetch()
}

function clearSearch() {
  keywordInput.value = ''
  if (!keyword.value) return
  keyword.value = ''
  switchFilterThenFetch()
}

function pickTopic(id) {
  const wasSearching = !!keyword.value
  if (wasSearching) {
    keyword.value = ''
    keywordInput.value = ''
  }
  // 「全部」同时要取消「只看朋友」，否则点全部看似无反应（两种筛选叠加）
  const clearingFriend = id === 0 && friendOnly.value
  if (!wasSearching && topicId.value === id && !clearingFriend) return
  topicId.value = id
  if (id === 0) friendOnly.value = false
  switchFilterThenFetch()
}

function pickSort(s) {
  if (sort.value === s) return
  sort.value = s
  switchFilterThenFetch()
}

/* 切换筛选只在「工具栏被滚出视口」时才回滚，且一律回到页面顶部 0：
   原实现滚到「列表顶 − 76」，而点了 chip 的时候视口本来就在顶部，
   这个目标反而在下方 108px，页面于是往下坠一截，把刚点的 chip 送进
   悬浮导航底下；列表越短浏览器 clamp 得越狠，落点也就跟着变。
   「全部 / 旅行 / 美食 / 摄影」看起来各跳各的，根因就是这里。
   现在分两种：工具栏还露在导航下沿之下 → 页面一动不动，只换数据；
   真被滚没了（比如从侧栏话题点进来）→ 平滑回顶。回到 0 一定可达，
   不受新列表长度影响，落点恒定。
   先滚、后换仍保留：列表骤然变短时不会把阅读位置 clamp 出一跳。 */
let filterScrollTimer = null
function switchFilterThenFetch() {
  if (filterScrollTimer) {
    clearTimeout(filterScrollTimer)
    filterScrollTimer = null
  }
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const bar = toolbarRef.value
  const navBottom =
    document.querySelector('.nav-inner')?.getBoundingClientRect().bottom ?? 72
  const covered = bar ? bar.getBoundingClientRect().top < navBottom : false
  const dist = window.scrollY
  if (reduce || !covered || dist < 24) {
    fetchList()
    return
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
  const wait = Math.min(700, 220 + dist * 0.4)
  filterScrollTimer = setTimeout(() => {
    filterScrollTimer = null
    fetchList()
  }, wait)
}

onMounted(() => {
  tick()
  clockTimer = setInterval(tick, 1000)
  fetchTopics()
  fetchList()
  fetchHot()
  // 从发布页「再写一段」回来时，直接展开就地输入框
  if (route.query.compose) {
    nextTick(() => composerRef.value?.focus?.())
  }
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (filterScrollTimer) clearTimeout(filterScrollTimer)
})
</script>

<style scoped>
/* ============================================================
   墨色玻璃 · 唯一定义处
   全页的卡片、控件、边框都从这里取值，别在下面写第二个色值。
   ============================================================ */
.ink-home {
  --m-card: rgba(30, 26, 22, 0.74);        /* 伪玻璃底：半透明实色 */
  --m-card-hover: rgba(36, 31, 26, 0.86);
  --m-line: rgba(232, 220, 200, 0.08);     /* 冷白细边 */
  --m-line-2: rgba(232, 220, 200, 0.16);
  --m-ink-1: #ede6d8;
  --m-ink-2: #c9c1b0;
  --m-ink-3: #9a9280;
  --m-ink-4: #7e7666;
  --m-cinnabar: #c0523d;                   /* 夜间朱砂，比纸感版亮一档 */
  --m-gold: #c9a227;

  /* 子组件（LikeButton / CollectButton）读的是这几个全局变量，
     在此重定义即可让它们适配墨底，无需改组件一行。 */
  --txt-1: var(--m-ink-1);
  --txt-2: var(--m-ink-2);
  --txt-3: var(--m-ink-4);
  --c-gold: var(--m-gold);
  --card-border: var(--m-line);
  --card-border-hover: var(--m-line-2);
  --el-mask-color: rgba(16, 14, 12, 0.62);

  min-height: 100vh;
  padding: 96px 0 80px;
  /* 背景交给 App.vue 的水墨图层，这里只叠一层压暗，保证文字可读 */
  background: linear-gradient(180deg, rgba(12, 11, 10, 0.42) 0%, rgba(12, 11, 10, 0.62) 100%);
  color: var(--m-ink-1);
}

.home-container {
  width: min(1040px, calc(100% - 48px));
  margin: 0 auto;
}

/* ==================== 刊头 ====================
   一行收完。左侧卷首语用朱砂竖线开个头，形成「栏目」感而不是「标题」感，
   这样它和导航里的站名不会互相抢。 */
.masthead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 15px;
}
.mast-lead {
  min-width: 0;
  padding-left: 11px;
  border-left: 2px solid var(--m-cinnabar);
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--m-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mast-side {
  display: flex;
  align-items: center;
  gap: 18px;
  flex: none;
}
.mast-count {
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--m-ink-4);
  white-space: nowrap;
}
.mast-count b {
  margin-right: 3px;
  font-size: 16px;
  font-weight: 500;
  color: var(--m-cinnabar);
  font-variant-numeric: tabular-nums;
}
.mast-publish {
  padding: 7px 20px;
  font-size: 12.5px;
  letter-spacing: 0.16em;
  color: #f6efe2;
  background: var(--m-cinnabar);
  border-radius: 6px;
  text-decoration: none;
  transition: filter 0.2s ease, transform 0.2s ease;
}
.mast-publish:hover { filter: brightness(1.12); transform: translateY(-1px); }

/* ==================== 工具栏 ====================
   一行装下四组控件，底部一条细线与内容分隔；
   原来「筛选条 50px + 状态行 40px」两条带合成这一条。 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 13px;
  border-bottom: 1px solid var(--m-line);
}

/* 话题横向滚动。这里刻意不撑满：撑满会把「只看朋友」推到最右，
   中间空出四百多像素，看起来像漏了一组控件。让它按内容宽度收着，
   左组（话题 + 只看朋友）与右组（搜索 + 排序）各自成团，空白落在两团之间。 */
.chips {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.chips::-webkit-scrollbar { display: none; }

.chip {
  flex: none;
  height: 28px;
  padding: 0 12px;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--m-ink-3);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}
.chip:hover { color: var(--m-ink-1); background: rgba(255, 255, 255, 0.05); }
.chip.on {
  color: #f0d5cd;
  background: rgba(192, 82, 61, 0.18);
  border-color: rgba(192, 82, 61, 0.36);
}

/* 「只看朋友」不属于话题，用竖线把它和话题分开 */
.toolbar-gap {
  flex: none;
  width: 1px;
  height: 15px;
  margin: 0 3px;
  background: var(--m-line-2);
}
.chip-friend { flex: none; border-color: var(--m-line); }

.search {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: none;
  height: 32px;
  margin-left: auto;
  padding: 0 10px;
  background: var(--m-card);
  border: 1px solid var(--m-line);
  border-radius: 6px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: border-color 0.2s ease;
}
.search:focus-within { border-color: var(--m-line-2); }
.search-icon {
  width: 14px;
  height: 14px;
  flex: none;
  color: var(--m-ink-4);
}
.search-input {
  width: 146px;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--m-ink-1);
}
.search-input::placeholder { color: var(--m-ink-4); }
.search-clear {
  border: none;
  background: transparent;
  font-size: 15px;
  line-height: 1;
  color: var(--m-ink-4);
  cursor: pointer;
  padding: 0 2px;
}
.search-clear:hover { color: var(--m-ink-2); }

.seg {
  display: flex;
  flex: none;
  height: 32px;
  padding: 3px;
  background: var(--m-card);
  border: 1px solid var(--m-line);
  border-radius: 6px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.seg button {
  padding: 0 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--m-ink-3);
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}
.seg button:hover { color: var(--m-ink-1); }
.seg button.on {
  color: #f0d5cd;
  background: rgba(192, 82, 61, 0.2);
}

/* ==================== 筛选提示（条件性） ==================== */
.filter-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 2px 0;
  font-size: 12px;
  color: var(--m-ink-3);
}
.filter-text {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.filter-text em {
  font-style: normal;
  color: var(--m-ink-4);
  font-variant-numeric: tabular-nums;
}
.filter-reset {
  flex: none;
  padding: 0;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  color: var(--m-ink-4);
  cursor: pointer;
  border-bottom: 1px solid var(--m-line-2);
  transition: color 0.2s ease, border-color 0.2s ease;
}
.filter-reset:hover { color: var(--m-cinnabar); border-color: rgba(192, 82, 61, 0.5); }

/* ==================== 两栏栅格 ====================
   主栏收窄到约 740px：原来 802px 宽、13.5px 字号，一行排到 60 多个汉字，
   眼睛从行尾回到行首会串行。现在一行约 47 字，落在中文舒适区。 */
.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 276px;
  gap: 24px;
  align-items: start;
  padding-top: 20px;
}
/* 有筛选提示时不重复留白，避免出现两段间距叠加 */
.filter-note + .home-grid { padding-top: 12px; }

/* ==================== 列表容器 ====================
   卡片本体（材质、排版、图片网格、头条/短句变体）全部搬进
   <MomentCard variant="feed">，首页只留列表容器与分页。 */
.feed { min-width: 0; min-height: 60vh; }

/* ==================== 载入更多 / 空状态 ==================== */
.load-more { text-align: center; padding: 10px 0 4px; }
.load-btn {
  padding: 9px 30px;
  font-family: inherit;
  font-size: 13px;
  letter-spacing: 0.12em;
  color: var(--m-ink-3);
  background: var(--m-card);
  border: 1px solid var(--m-line);
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}
.load-btn:hover { color: var(--m-ink-1); border-color: var(--m-line-2); }

.empty {
  padding: 70px 0;
  text-align: center;
  background: var(--m-card);
  border: 1px solid var(--m-line);
  border-radius: 10px;
}
.empty-title { font-size: 15px; color: var(--m-ink-2); }
.empty-desc { margin-top: 8px; font-size: 13px; color: var(--m-ink-4); }
.empty-btn {
  display: inline-block;
  margin-top: 20px;
  padding: 8px 24px;
  font-size: 13px;
  color: #f0d5cd;
  background: rgba(192, 82, 61, 0.16);
  border: 1px solid rgba(192, 82, 61, 0.36);
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s ease;
}
.empty-btn:hover { background: rgba(192, 82, 61, 0.26); }

/* ==================== 侧栏 ==================== */
.side {
  position: sticky;
  top: 84px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.side-card {
  padding: 16px 18px;
  background: var(--m-card);
  border: 1px solid var(--m-line);
  border-radius: 10px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.055),
    0 10px 26px -16px rgba(0, 0, 0, 0.75);
}
.side-title {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.24em;
  color: var(--m-ink-3);
  padding-bottom: 11px;
  border-bottom: 1px solid var(--m-line);
}
.hot-list {
  list-style: none;
  margin-top: 4px;
}
.hot-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 0;
  border-bottom: 1px solid var(--m-line);
  cursor: pointer;
}
.hot-item:last-child { border-bottom: none; padding-bottom: 4px; }
.hot-no {
  flex: none;
  width: 15px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--m-ink-4);
  font-variant-numeric: tabular-nums;
}
.hot-no.top { color: var(--m-cinnabar); }
.hot-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.hot-title {
  font-size: 13px;
  line-height: 1.55;
  color: var(--m-ink-2);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  transition: color 0.2s ease;
}
.hot-item:hover .hot-title { color: var(--m-cinnabar); }
.hot-meta { font-size: 12px; color: var(--m-ink-4); }
.hot-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--m-ink-4);
}

/* ==================== 侧栏：话题 ==================== */
.topic-list { list-style: none; margin-top: 2px; }
.topic-item {
  display: flex;
  align-items: baseline;
  gap: 9px;
  padding: 9px 0;
  border-bottom: 1px solid var(--m-line);
  cursor: pointer;
}
.topic-item:last-child { border-bottom: none; padding-bottom: 2px; }
.topic-name {
  flex: none;
  font-size: 13px;
  color: var(--m-ink-2);
  transition: color 0.2s ease;
}
.topic-desc {
  min-width: 0;
  font-size: 11.5px;
  color: var(--m-ink-4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topic-item:hover .topic-name { color: var(--m-cinnabar); }
.topic-item.on .topic-name { color: var(--m-cinnabar); }
.topic-item.on .topic-desc { color: rgba(192, 82, 61, 0.7); }

/* ==================== 右下角浮标 ==================== */
.pulse {
  position: fixed;
  right: 24px;
  bottom: 22px;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  background: rgba(24, 21, 18, 0.78);
  border: 1px solid var(--m-line);
  border-radius: 8px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 8px 24px -14px rgba(0, 0, 0, 0.8);
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  user-select: none;
}
.pulse-time {
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--m-ink-2);
}
.pulse-sep {
  width: 1px;
  height: 11px;
  background: var(--m-line-2);
}
.pulse-txt {
  font-size: 12px;
  color: var(--m-ink-4);
}

/* ==================== 响应式 ==================== */
@media (max-width: 1080px) {
  .home-grid { grid-template-columns: minmax(0, 1fr); }
  /* 侧栏收起后主栏会撑满整宽，850px 以上一行就到 70 字。
     这里把「刊头 / 工具栏 / 提示 / 列表」一起收成同一列并居中，
     否则卡片居中、工具栏却通栏，左右边界对不上。 */
  .masthead, .toolbar, .filter-note, .feed {
    width: 100%;
    max-width: 740px;
    margin-left: auto;
    margin-right: auto;
  }
  .side { display: none; }
  /* 侧栏收起后内容列只到 740，一行塞不下「话题 + 只看朋友 + 搜索 + 排序」：
     768px 的 iPad 上最后一个话题会被切掉半个。到这里就让工具栏换行，
     话题独占一行。 */
  .toolbar { flex-wrap: wrap; row-gap: 10px; }
  .chips { flex: 1 0 100%; }
}
@media (max-width: 760px) {
  .ink-home { padding: 84px 0 64px; }
  .home-container { width: calc(100% - 28px); }
  .masthead {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding-bottom: 13px;
  }
  .mast-lead { white-space: normal; font-size: 13px; }
  .mast-side { width: 100%; justify-content: space-between; }

  /* 话题独占一行（可横滑），下面一行放筛选 / 搜索 / 排序 */
  .toolbar { flex-wrap: wrap; row-gap: 10px; }
  .chips {
    order: 1;
    flex: 1 0 100%;
    /* 移动端这排一定会溢出，用右侧渐隐提示“还能滑”，
       desktop 不溢出时不加遮罩，否则会误切最后一个话题 */
    -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 22px), transparent 100%);
    mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 22px), transparent 100%);
  }
  .toolbar-gap { display: none; }
  /* 输入框在窄屏被抬到 16px（防 iOS 聚焦缩放），和「只看朋友 + 排序」
     挤在一行时占位文案会被截成「搜索标题 / 正…」。让搜索独占一行。 */
  .search { order: 2; flex: 1 0 100%; margin-left: 0; }
  .search-input { width: 100%; }
  .chip-friend { order: 3; }
  .seg { order: 4; margin-left: auto; }

  /* 卡片的窄屏排版在 MomentCard 里，这里不再重复 */
  .pulse { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .mast-publish { transition: none; }
}
</style>
