<!-- src/components/LikeButton.vue —— 通用点赞按钮
     对接后端 /likes 三个接口：挂载时拉真实点赞数与"我是否已赞"，点击切换。
     props:
       targetId   Number  必填  动态id(1分享) 或 评论id(2评论)
       targetType Number  1=分享 2=评论
       initial    Number  后端列表/详情里带的 likeCount（作为首屏占位，随后用 /count 覆盖）
     emits: change({ liked, count }) —— 便于父组件同步本地数据 -->
<template>
  <span
    class="like-btn"
    :class="{ liked: liked, busy: busy }"
    :title="logged ? (liked ? '取消点赞' : '点赞') : '登录后点赞'"
    @click.stop="onToggle"
  >
    <span class="heart">{{ liked ? '♥' : '♡' }}</span>
    <span class="num">{{ count }}</span>
  </span>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getLikeCount, getLikeState, toggleLike } from '../utils/likeApi'

const props = defineProps({
  targetId: { type: Number, required: true },
  targetType: { type: Number, default: 1 },
  initial: { type: Number, default: 0 },
})
const emit = defineEmits(['change'])

const logged = ref(!!localStorage.getItem('token'))
const liked = ref(false)
const count = ref(props.initial)
const busy = ref(false)

onMounted(async () => {
  // 点赞数对所有人生效（/count 后端已放行）
  try {
    count.value = await getLikeCount(props.targetId, props.targetType)
  } catch (e) { /* 保留 initial 兜底 */ }

  // "我是否已赞"仅登录后查询（/state 需要鉴权）
  if (logged.value) {
    try {
      liked.value = await getLikeState(props.targetId, props.targetType)
    } catch (e) { /* 401 等情况保持未赞 */ }
  }
})

async function onToggle() {
  if (busy.value) return
  if (!logged.value) {
    ElMessage.warning('请先登录后再点赞')
    return
  }
  busy.value = true
  try {
    const op = await toggleLike(props.targetId, props.targetType)
    if (op === 1) {
      liked.value = true
      count.value = Math.max(0, count.value + 1)
    } else if (op === -1) {
      liked.value = false
      count.value = Math.max(0, count.value - 1)
    }
    emit('change', { liked: liked.value, count: count.value })
  } catch (e) {
    // 错误提示由 main.js 响应拦截器统一弹出
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.like-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--txt-3);
  cursor: pointer;
  user-select: none;
  transition: color 0.2s, transform 0.15s;
}
.like-btn:hover {
  color: var(--txt-1);
}
.like-btn.liked {
  color: #e6a8b4; /* 淡胭脂，配合暗色玄幻风 */
}
.like-btn.busy {
  opacity: 0.6;
  pointer-events: none;
}
.like-btn:active {
  transform: scale(0.92);
}
.heart {
  font-size: 15px;
  line-height: 1;
}
</style>
