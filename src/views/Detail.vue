<!-- src/views/Detail.vue —— 动态详情页（尘叙阁·暗色玄幻风）
     数据：GET /moments/{id} 一次性拿到动态 + 已组装好的评论树
     评论：POST /comments（一级评论 parentId 默认 0；回复带 parentId / replyUserId）
     删除：DELETE /comments/{id}（仅自己的评论可删）
     评论请求头：main.js 的请求拦截器已同时带上 Authorization 与 token 两个头 -->
<template>
  <div class="detail" v-loading="loading">
    <!-- 返回 -->
    <div class="back-link" @click="router.back()">← 返回尘叙阁</div>

    <!-- 动态主体卡片 -->
    <div class="detail-card nr-card-deep" v-if="moment">
      <!-- 作者行 -->
      <div class="moment-author">
        <img class="avatar" :src="imgUrl(moment.avatar)" alt="avatar" />
        <div class="author-info">
          <span class="nickname">{{ moment.nickname }}</span>
          <span class="author-time">{{ formatTime(moment.createTime) }}</span>
        </div>
      </div>

      <!-- 标题 + 正文 -->
      <h1 class="detail-title" v-if="moment.title">{{ moment.title }}</h1>
      <p class="detail-content">{{ moment.content }}</p>

      <!-- 图片大图 -->
      <div class="detail-images" v-if="moment.images?.length">
        <img
          v-for="(img, i) in moment.images"
          :key="i"
          class="big-img"
          :src="imgUrl(img)"
          :alt="moment.title"
          @click="preview(i)"
        />
      </div>

      <!-- 地点 / 心情 -->
      <div class="detail-tags" v-if="moment.location || moment.mood">
        <span v-if="moment.location" class="meta-chip">📍 {{ moment.location }}</span>
        <span v-if="moment.mood" class="meta-chip">心情 · {{ moment.mood }}</span>
      </div>

      <!-- 统计（点赞/收藏走 /likes、/collects 真实数据，评论暂为展示） -->
      <div class="detail-stats">
        <span class="stat-like"><LikeButton :targetId="moment.id" :targetType="1" :initial="moment.likeCount ?? 0" /> 赞</span>
        <span>✎ {{ moment.commentCount ?? 0 }} 评</span>
        <span class="stat-collect"><CollectButton :momentId="moment.id" :initial="moment.collectCount ?? 0" /> 藏</span>
        <!-- 仅作者可见：编辑 / 删除 -->
        <span v-if="isMine" class="stat-op" @click="goEdit">编辑</span>
        <span v-if="isMine" class="stat-op stat-op-danger" @click="handleDelete">删除</span>
      </div>
    </div>

    <!-- 评论区 -->
    <div class="comment-section nr-card-deep" v-if="moment">
      <h3 class="comment-heading">
        评 论
        <span class="comment-count">{{ commentTotal }}</span>
      </h3>

      <!-- 一级评论列表（递归渲染子回复） -->
      <div class="comment-tree" v-if="comments.length">
        <CommentNode
          v-for="c in comments"
          :key="c.id"
          :comment="c"
          :level="0"
          :canDelete="canDelete"
          @reply="onReply"
          @delete="onDelete(c.id)"
        />
      </div>
      <div v-else-if="!loadingComments" class="comment-empty">此处静寂，留下第一句回响吧</div>

      <!-- 回复提示条：回复某条时显示 -->
      <div class="reply-banner" v-if="replyTarget.comment" @click="cancelReply">
        <span>
          回复 <b>{{ replyTarget.comment.commentUsername }}</b>
        </span>
        <span class="reply-cancel">✕ 取消</span>
      </div>

      <!-- 评论输入框 -->
      <div class="comment-input" v-if="token">
        <el-input
          v-model="commentText"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          :placeholder="replyTarget.comment ? '回复 ' + replyTarget.comment.commentUsername + ' …' : '写下你的回响…'"
          class="comment-textarea"
        />
        <div class="comment-input-actions">
          <el-button class="cancel-btn" v-if="replyTarget.comment" @click="cancelReply">取消回复</el-button>
          <el-button
            class="post-btn"
            :loading="posting"
            @click="onPost"
          >发 表</el-button>
        </div>
      </div>
      <div class="login-tip" v-else>
        登入尘叙阁后才能留下回响
        <router-link to="/login" class="login-link">去登录</router-link>
      </div>
    </div>

    <!-- 空态 -->
    <div class="detail-empty" v-if="!loading && !moment">
      此地风雪迷途，故事似乎不存在了
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'
import CommentNode from '../components/CommentNode.vue'
import LikeButton from '../components/LikeButton.vue'
import CollectButton from '../components/CollectButton.vue'

const route = useRoute()
const router = useRouter()

const momentId = Number(route.params.id)

/* ---------------- 数据状态 ---------------- */
const moment = ref(null)
const comments = ref([])      // 一级评论（带 children 树）
const loading = ref(false)
const loadingComments = ref(false)
const posting = ref(false)
const commentText = ref('')
const token = ref(localStorage.getItem('token') || '')

// 当前回复目标
const replyTarget = reactive({
  comment: null,             // CommentVO
  parentId: 0,
  replyUserId: null,
})

// 当前登录用户 id（从 JWT payload 中解析，用于判断评论是否可删）
const myUserId = ref(null)

/* ---------------- 评论总数 ---------------- */
const commentTotal = computed(() => {
  let n = 0
  const walk = (list) => {
    for (const c of list || []) {
      n++
      if (c.children?.length) walk(c.children)
    }
  }
  walk(comments.value)
  return n
})

/* ---------------- 请求详情：GET /moments/{id} ---------------- */
async function fetchDetail() {
  loading.value = true
  loadingComments.value = true
  try {
    const res = await axios.get(`/moments/${momentId}`)
    moment.value = res.data.data ?? null
    // comments 是后端已组装好的树形评论列表
    comments.value = moment.value?.comments ?? []
  } catch (err) {
    // 错误提示由 main.js 的响应拦截器统一弹出
  } finally {
    loading.value = false
    loadingComments.value = false
  }
}

/* ---------------- 解析 JWT 中的用户 id ---------------- */
function resolveMyUserId() {
  try {
    const raw = localStorage.getItem('token')
    if (!raw) return
    const payload = JSON.parse(atob(raw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    myUserId.value = payload.userId ?? payload.uid ?? payload.id ?? payload.sub ?? null
  } catch (e) {
    myUserId.value = null
  }
}

// 仅自己的评论可删除
function canDelete(comment) {
  if (!token.value || myUserId.value == null) return false
  return Number(comment.commentUserId) === Number(myUserId.value)
}

/* ---------------- 动态管理：编辑 / 删除（仅作者） ---------------- */
const isMine = computed(() =>
  moment.value?.userId != null && myUserId.value != null
  && Number(moment.value.userId) === Number(myUserId.value))

function goEdit() {
  router.push({ path: '/publish', query: { edit: moment.value.id } })
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm('删除后不可恢复，确定删除这条动态吗？', '删除动态', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await axios.delete(`/moments/${moment.value.id}`)
    ElMessage.success('已删除')
    router.push('/home')
  } catch (err) {
    /* 错误提示由响应拦截器统一弹出 */
  }
}

/* ---------------- 回复 / 取消回复 ---------------- */
// level === 0：回复一级评论 → parentId=该评论 id，replyUserId=评论作者
// level >= 1：回复子评论 → parentId 保持其一级评论 id，replyUserId=被回复人 id
function onReply(comment, level) {
  if (level === 0) {
    replyTarget.parentId = comment.id
    replyTarget.replyUserId = comment.commentUserId
  } else {
    replyTarget.parentId = comment.parentId ?? comment.id
    replyTarget.replyUserId = comment.commentUserId
  }
  replyTarget.comment = comment
  commentText.value = ''
}

function cancelReply() {
  replyTarget.comment = null
  replyTarget.parentId = 0
  replyTarget.replyUserId = null
}

/* ---------------- 发表评论：POST /comments ---------------- */
async function onPost() {
  const content = commentText.value.trim()
  if (!content) {
    ElMessage.warning('回响不可为空')
    return
  }
  posting.value = true
  try {
    const body = {
      content,
      momentId,
      parentId: replyTarget.parentId || 0,  // 默认 0 表示一级评论
    }
    if (replyTarget.replyUserId) body.replyUserId = replyTarget.replyUserId
    await axios.post('/comments', body)
    ElMessage.success('回响已留下')
    commentText.value = ''
    cancelReply()
    // 重新拉详情刷新评论树
    fetchDetail()
  } catch (err) {
    // 错误提示由 main.js 的响应拦截器统一弹出
  } finally {
    posting.value = false
  }
}

/* ---------------- 删除评论：DELETE /comments/{id} ---------------- */
async function onDelete(commentId) {
  try {
    await ElMessageBox.confirm('确定删除这条回响吗？', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch (e) {
    return // 取消
  }
  try {
    await axios.delete(`/comments/${commentId}`)
    ElMessage.success('已删除')
    fetchDetail()
  } catch (err) {
    // 错误提示由 main.js 的响应拦截器统一弹出
  }
}

/* ---------------- 图片地址处理 ---------------- */
function imgUrl(img) {
  if (!img) return ''
  if (img.startsWith('http') || img.startsWith('//')) return img
  return img.startsWith('/') ? img : '/' + img
}

function preview(i) {
  window.open(imgUrl(moment.value?.images?.[i]), '_blank')
}

/* ---------------- 时间格式化 ---------------- */
function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t)
  const p = (n) => (n < 10 ? '0' + n : n)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(() => {
  resolveMyUserId()
  fetchDetail()
})
</script>

<style scoped>
.detail {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 80px;
}

.back-link {
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--txt-3);
  cursor: pointer;
  margin-bottom: 18px;
  transition: color 0.2s;
}
.back-link:hover {
  color: var(--txt-1);
}

/* 动态主体卡片 */
.detail-card {
  padding: 30px 32px;
  margin-bottom: 24px;
}

.moment-author {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--card-border);
  background: rgba(255, 255, 255, 0.05);
}
.author-info {
  display: flex;
  flex-direction: column;
  line-height: 1.5;
}
.nickname {
  font-size: 16px;
  letter-spacing: 1px;
  color: var(--txt-1);
}
.author-time {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--txt-3);
}

.detail-title {
  font-family: var(--font-brush);
  font-size: 30px;
  font-weight: 400;
  letter-spacing: 4px;
  color: #f5f5f5;
  margin-bottom: 14px;
}

.detail-content {
  font-size: 15px;
  line-height: 2;
  letter-spacing: 1px;
  color: var(--txt-2);
  white-space: pre-wrap;
}

/* 图片大图 */
.detail-images {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 18px;
}
.big-img {
  width: 100%;
  height: 170px;
  object-fit: cover;
  border-radius: 2px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: filter 0.25s;
  filter: saturate(0.9);
}
.big-img:hover {
  filter: saturate(1);
}
.detail-images:has(.big-img:only-child) .big-img {
  grid-column: span 3;
  height: 340px;
}

.detail-tags {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
.meta-chip {
  padding: 2px 10px;
  border: 1px solid var(--card-border);
  border-radius: 20px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--txt-3);
}

.detail-stats {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 16px;
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--txt-3);
}
.detail-stats .stat-like,
.detail-stats .stat-collect {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
/* 作者专属：编辑 / 删除 */
.detail-stats .stat-op {
  margin-left: auto;
  padding: 3px 12px;
  border: 1px solid var(--card-border);
  border-radius: 2px;
  cursor: pointer;
  color: var(--txt-2);
  letter-spacing: 2px;
  transition: all 0.2s ease;
}
.detail-stats .stat-op:hover {
  border-color: var(--card-border-hover);
  color: var(--txt-1);
}
.detail-stats .stat-op-danger:hover {
  border-color: #7a3b3b;
  color: #d98a8a;
}
.detail-stats .stat-op + .stat-op {
  margin-left: 0;
}

/* ---------- 评论区 ---------- */
.comment-section {
  padding: 24px 32px 30px;
}
.comment-heading {
  font-size: 16px;
  letter-spacing: 6px;
  color: var(--nr-white);
  font-weight: 400;
  margin-bottom: 12px;
}
.comment-count {
  font-size: 12px;
  color: var(--txt-3);
  margin-left: 4px;
  letter-spacing: 0;
}

.comment-empty {
  text-align: center;
  padding: 36px 0;
  font-size: 14px;
  letter-spacing: 2px;
  color: var(--txt-3);
}

/* 回复提示条 */
.reply-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 0 0;
  padding: 8px 14px;
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--txt-2);
  background: var(--fill);
  border: 1px solid var(--card-border);
  border-radius: 2px;
  cursor: pointer;
}
.reply-banner b {
  color: #e8d9b5;
  font-weight: 400;
}
.reply-cancel {
  font-size: 12px;
  color: var(--txt-3);
}

/* 评论输入框 */
.comment-input {
  margin-top: 14px;
}
.comment-textarea :deep(.el-textarea__inner) {
  background: var(--fill);
  box-shadow: 0 0 0 1px var(--card-border) inset;
  border-radius: 2px;
  color: var(--txt-1);
}
.comment-textarea :deep(.el-textarea__inner::placeholder) {
  color: var(--txt-3);
}
.comment-input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 10px;
}
.cancel-btn {
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--txt-2);
  letter-spacing: 2px;
}
.cancel-btn:hover,
.cancel-btn:focus {
  border-color: var(--card-border-hover);
  color: var(--txt-1);
  background: transparent;
}
.post-btn {
  background: rgba(255, 255, 255, 0.92);
  border: none;
  color: #0a0a0a;
  letter-spacing: 4px;
}
.post-btn:hover,
.post-btn:focus {
  background: #fff;
  color: #0a0a0a;
}
.post-btn:disabled {
  opacity: 0.5;
  background: rgba(255, 255, 255, 0.92);
  color: #0a0a0a;
}

.login-tip {
  margin-top: 16px;
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--txt-3);
}
.login-link {
  color: #e8d9b5;
  text-decoration: none;
  margin-left: 8px;
}
.login-link:hover {
  text-decoration: underline;
}

.detail-empty {
  text-align: center;
  padding: 80px 0;
  font-size: 14px;
  letter-spacing: 3px;
  color: var(--txt-3);
}
</style>
