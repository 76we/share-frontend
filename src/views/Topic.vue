<!-- src/views/Topic.vue —— 话题详情页：展示单个话题的名称/描述与该话题下所有动态
     复用 GET /topics（取话题信息）+ GET /moments/list?topicId=x（动态列表），后端零改动。 -->
<template>
  <div class="topic-wrap">
    <div class="topic-inner">
      <!-- 话题抬头 -->
      <header class="topic-hero nr-card nr-glow">
        <button class="topic-back" @click="router.back()">‹ 返回</button>
        <div class="topic-mark" aria-hidden="true">卷</div>
        <div class="topic-heading">
          <h1 class="topic-name">{{ topic?.name || '话题' }}</h1>
          <p class="topic-desc">{{ topic?.description || '此卷尚无题记，且随尘笔漫叙。' }}</p>
        </div>
        <span class="topic-rule"></span>
        <p class="topic-count">共 {{ total }} 篇 · 皆系于此卷</p>
      </header>

      <!-- 动态列表 -->
      <section class="topic-body">
        <div v-loading="loading" class="card-list">
          <!-- 与个人中心同一套卡片组件，只多一个「卷内序号」 -->
          <MomentCard
            v-for="(m, idx) in moments"
            :key="m.id"
            :moment="m"
            variant="ink"
            :index="idx"
            class="card-enter"
            :style="{ animationDelay: Math.min(idx, 8) * 0.08 + 's' }"
          />
        </div>

        <!-- 空状态 -->
        <div v-if="!loading && moments.length === 0" class="empty">
          <span class="empty-seal">空</span>
          <p class="empty-title">此卷尚无留痕</p>
          <p class="empty-sub">尘间尚有留白，静待落笔成叙</p>
        </div>

        <!-- 载入更多 -->
        <div v-if="hasMore && !loading" class="load-more">
          <el-button @click="loadMore">载入更多</el-button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import MomentCard from '../components/MomentCard.vue'

const route = useRoute()
const router = useRouter()

const topicId = computed(() => Number(route.params.id))
const topic = ref(null)
const moments = ref([])
const total = ref(0)
const page = ref(1)
const size = 10
const hasMore = ref(false)
const loading = ref(false)

async function fetchTopic() {
  try {
    const res = await axios.get('/topics')
    const list = res.data?.data ?? []
    topic.value = list.find((t) => Number(t.id) === topicId.value) || { name: '话题' }
  } catch (e) { /* 拦截器已提示 */ }
}

/* 话题页会在 /topic/1 → /topic/2 之间原地复用组件，上一个话题的响应
   可能后到；seq 对号，过期响应丢弃，避免「切到旅行却显示美食」。 */
let listSeq = 0

async function fetchMoments(reset = true) {
  const seq = ++listSeq
  if (reset) {
    page.value = 1
    moments.value = []
  }
  loading.value = true
  try {
    const res = await axios.get('/moments/list', {
      params: { page: page.value, size, topicId: topicId.value },
    })
    if (seq !== listSeq) return
    const data = res.data?.data ?? {}
    moments.value = reset ? (data.records ?? []) : [...moments.value, ...(data.records ?? [])]
    total.value = Number(data.total ?? 0)
    hasMore.value = data.current < data.pages
  } catch (e) {
  } finally {
    if (seq === listSeq) loading.value = false
  }
}

async function loadMore() {
  if (loading.value || !hasMore.value) return
  page.value += 1
  await fetchMoments(false)
}

onMounted(() => {
  fetchTopic()
  fetchMoments(true)
})

watch(topicId, () => {
  fetchTopic()
  fetchMoments(true)
})
</script>

<style scoped>
.topic-wrap { max-width: 960px; margin: 0 auto; padding: 36px 16px 80px; }

.topic-hero {
  position: relative;
  overflow: hidden;
  text-align: center;
  padding: 40px 30px 28px;
  margin-bottom: 24px;
}
.topic-back {
  position: absolute;
  top: 16px;
  left: 20px;
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--txt-3);
  padding: 5px 14px;
  font-size: 12px;
  letter-spacing: 2px;
  cursor: pointer;
  border-radius: 2px;
}
.topic-back:hover { color: var(--c-gold); border-color: var(--c-gold-dim); }
.topic-mark {
  position: absolute;
  top: 18px;
  right: 26px;
  font-family: var(--font-brush);
  font-size: 42px;
  color: var(--c-gold-faint);
  opacity: .35;
}
.topic-heading { margin-bottom: 14px; }
.topic-name {
  font-family: var(--font-brush);
  font-size: 34px;
  font-weight: 400;
  letter-spacing: 4px;
  color: #f5f5f5;
  margin: 0 0 10px;
}
.topic-desc {
  font-size: 13px;
  line-height: 1.8;
  color: var(--txt-2);
  margin: 0;
}
.topic-rule {
  display: block;
  width: 60px;
  height: 1px;
  background: var(--c-gold-dim);
  margin: 18px auto 12px;
}
.topic-count { font-size: 11px; letter-spacing: 2px; color: var(--txt-3); margin: 0; }

.card-list { display: flex; flex-direction: column; gap: 18px; }
/* 卡片本体在 <MomentCard variant="ink">（与个人中心同一套），
   这里只留列表间距与入场动画。 */

.empty { text-align: center; padding: 54px 0; }
.empty-seal {
  display: inline-grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 1px solid var(--c-gold-dim);
  color: var(--c-gold);
  font-family: var(--font-brush);
  font-size: 22px;
  margin-bottom: 14px;
}
.empty-title { font-family: var(--font-brush); font-size: 22px; color: var(--txt-1); letter-spacing: 2px; margin: 8px 0; }
.empty-sub { font-size: 12px; color: var(--txt-3); margin: 0; }
.load-more { display: flex; justify-content: center; padding: 24px 0; }
.load-more .el-button {
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--txt-2);
  letter-spacing: 3px;
}
.load-more .el-button:hover { border-color: var(--c-gold-dim); color: var(--c-gold); }

.card-enter { animation: cardIn .5s ease both; }
@keyframes cardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
</style>
