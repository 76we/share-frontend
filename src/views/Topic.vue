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
          <div
            v-for="(m, idx) in moments"
            :key="m.id"
            class="moment-card nr-card nr-glow card-enter"
            :style="{ animationDelay: Math.min(idx, 8) * 0.08 + 's' }"
            @click="router.push(`/detail/${m.id}`)"
          >
            <span class="card-index">{{ idx + 1 < 10 ? '0' + (idx + 1) : idx + 1 }}</span>

            <div class="moment-author author-link" :title="'看看 ' + (m.nickname || 'TA') + ' 的主页'" @click.stop="goProfile(m.userId)">
              <span class="avatar-ring">
                <img class="avatar" :src="imgUrl(m.avatar)" alt="avatar" />
              </span>
              <div class="author-info">
                <span class="nickname">{{ m.nickname }}</span>
                <span class="author-time">{{ formatTime(m.createTime) }}</span>
              </div>
            </div>

            <h2 class="moment-title" v-if="m.title">{{ m.title }}</h2>
            <p class="moment-content">{{ m.content }}</p>

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
import LikeButton from '../components/LikeButton.vue'
import CollectButton from '../components/CollectButton.vue'

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

async function fetchMoments(reset = true) {
  if (reset) {
    page.value = 1
    moments.value = []
  }
  loading.value = true
  try {
    const res = await axios.get('/moments/list', {
      params: { page: page.value, size, topicId: topicId.value },
    })
    const data = res.data?.data ?? {}
    moments.value = reset ? (data.records ?? []) : [...moments.value, ...(data.records ?? [])]
    total.value = Number(data.total ?? 0)
    hasMore.value = data.current < data.pages
  } catch (e) {
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value || !hasMore.value) return
  page.value += 1
  await fetchMoments(false)
}

function goProfile(userId) {
  if (userId != null) router.push(`/profile/${userId}`)
}
function imgUrl(img) {
  if (!img) return ''
  if (img.startsWith('http') || img.startsWith('//')) return img
  return img.startsWith('/') ? img : '/' + img
}
function preview(m, i) {
  window.open(imgUrl(m.images?.[i]), '_blank')
}
function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t)
  const p = (n) => (n < 10 ? '0' + n : n)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`
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
.moment-card {
  position: relative;
  padding: 20px 22px;
  cursor: pointer;
  transition: border-color .25s, box-shadow .25s;
}
.moment-card:hover { border-color: var(--card-border-hover); box-shadow: 0 4px 24px rgba(0, 0, 0, .3); }
.card-index {
  position: absolute;
  top: 16px;
  right: 20px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--c-gold-faint);
  opacity: .5;
}
.moment-author { display: flex; align-items: center; gap: 12px; }
.author-link { cursor: pointer; }
.author-link:hover .nickname { color: var(--c-gold); }
.avatar-ring {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--c-gold-dim);
  background: var(--fill);
}
.avatar { width: 100%; height: 100%; object-fit: cover; }
.author-info { display: flex; flex-direction: column; }
.nickname { font-size: 13px; color: var(--txt-1); letter-spacing: 1px; }
.author-time { font-size: 11px; color: var(--txt-3); margin-top: 2px; }
.moment-title {
  font-family: var(--font-brush);
  font-size: 22px;
  font-weight: 400;
  letter-spacing: 2px;
  color: #f0f0f0;
  margin: 14px 0 6px;
}
.moment-content {
  font-size: 13px;
  line-height: 1.8;
  color: var(--txt-2);
  margin: 8px 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.moment-images { display: grid; gap: 6px; margin: 12px 0; grid-template-columns: repeat(3, 1fr); }
.moment-images.imgs-1 { grid-template-columns: 1fr; max-width: 360px; }
.moment-images.imgs-4 { grid-template-columns: repeat(2, 1fr); }
.grid-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 2px;
  border: 1px solid var(--card-border);
}
.moment-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--txt-3);
}
.meta-chip {
  padding: 3px 10px;
  border: 1px solid var(--card-border);
  border-radius: 2px;
}
.meta-stats { margin-left: auto; display: flex; align-items: center; gap: 16px; }

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
