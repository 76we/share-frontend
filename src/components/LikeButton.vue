<!-- src/components/LikeButton.vue —— 通用点赞按钮
     对接后端 /likes 三个接口：挂载时拉真实点赞数与"我是否已赞"，点击切换。
     props:
       targetId   Number  必填  动态id(1分享) 或 评论id(2评论)
       targetType Number  1=分享 2=评论
       initial    Number  后端列表/详情里带的 likeCount（作为首屏占位，随后用 /count 覆盖）
     emits: change({ liked, count }) —— 便于父组件同步本地数据 -->
<template>
  <span
    ref="btnEl"
    class="like-btn"
    :class="{ liked: liked, busy: busy }"
    :title="logged ? (liked ? '取消点赞' : '点赞') : '登录后点赞'"
    @click.stop="onToggle"
  >
    <span class="heart">{{ liked ? '♥' : '♡' }}</span>
    <span class="num">{{ count }}</span>
    <!-- 指尖飘心：只做视觉，不参与布局，动画结束即销毁 -->
    <span
      v-for="p in puffs"
      :key="p.id"
      class="heart-puff"
      :style="{
        left: p.x + 'px',
        top: p.y + 'px',
        '--dx': p.dx + 'px',
        '--rot': p.rot + 'deg',
      }"
      aria-hidden="true"
      @animationend="dropPuff(p.id)"
    >♥</span>
  </span>
</template>

<script setup>
import { ref, onMounted } from 'vue'
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

const btnEl = ref(null)
const puffs = ref([])   // 正在飘的心，动画播完即移除
let puffSeq = 0

function dropPuff(id) {
  puffs.value = puffs.value.filter((p) => p.id !== id)
}

/* 在点击坐标处生一颗心，向上浮起 0.34s 后淡出。
   用普通 DOM 节点而非 canvas，是为了让它天然跟随卡片的缩放与位移。 */
function spawnPuff(e) {
  if (!e || typeof e.clientX !== 'number') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const el = btnEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const id = ++puffSeq

  /* 起点横向吸附到心形附近：按钮是「❤ 12」这样一段文字，点数字时
     若严格按点击点起飘，心会从数字上方冒出来，显得偏。 */
  let px = e.clientX - rect.left
  const heartEl = el.querySelector('.heart')
  if (heartEl) {
    const hr = heartEl.getBoundingClientRect()
    const hx = hr.left - rect.left + hr.width / 2
    px = Math.max(hx - 4, Math.min(hx + 4, px))
  }

  puffs.value.push({
    id,
    x: px,
    y: e.clientY - rect.top,
    // 每颗心飘的方向略不同：严格竖直上浮会和按钮上的心对齐，看着像重影
    dx: Math.round(Math.random() * 10 - 5),
    rot: Math.round(Math.random() * 16 - 8),
  })
  // 兜底：animationend 万一不触发（标签页切后台、动画被禁用），别让节点越积越多
  setTimeout(() => dropPuff(id), 1200)
}

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

async function onToggle(e) {
  if (busy.value) return
  if (!logged.value) {
    ElMessage.warning('请先登录后再点赞')
    return
  }
  busy.value = true

  /* 乐观更新：心要在手指底下就冒出来，等接口往返再飘就不叫「从指尖浮起」了。
     失败再回滚，视觉上宁可短暂骗一下，也不要迟滞。 */
  const wasLiked = liked.value
  const wasCount = count.value
  liked.value = !wasLiked
  count.value = Math.max(0, wasCount + (wasLiked ? -1 : 1))
  if (!wasLiked) spawnPuff(e)

  try {
    const op = await toggleLike(props.targetId, props.targetType)
    // op 是服务端最终态：1 已赞 / -1 未赞。与本地不一致时以服务端为准
    if (op === 1 && !liked.value) {
      liked.value = true
      count.value = wasCount + 1
    } else if (op === -1 && liked.value) {
      liked.value = false
      count.value = Math.max(0, wasCount - 1)
    }
    emit('change', { liked: liked.value, count: count.value })
  } catch (err) {
    // 接口失败：回滚到点击前的状态，别让人以为赞上了
    // 错误提示由 main.js 响应拦截器统一弹出
    liked.value = wasLiked
    count.value = wasCount
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.like-btn {
  position: relative; /* 飘心的定位基准 */
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
/* 置灰只作用在图标与数字上：整块 opacity 会连带把飘心一起压暗 */
.like-btn.busy {
  pointer-events: none;
}
.like-btn.busy > .heart,
.like-btn.busy > .num {
  opacity: 0.6;
}
.like-btn:active {
  transform: scale(0.92);
}
.heart {
  font-size: 15px;
  line-height: 1;
}

/* 指尖飘心：绝对定位在点击点，margin 抵消自身尺寸使其正好居中于指尖 */
.heart-puff {
  position: absolute;
  z-index: 2;
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  font-size: 18px;
  line-height: 18px;
  text-align: center;
  color: inherit;
  /* 比按钮上的心亮一档，否则同色会被读成「按下时的重影」 */
  filter: brightness(1.15);
  pointer-events: none;
  user-select: none;
  animation: puff-up 0.34s cubic-bezier(0.22, 0.8, 0.3, 1) forwards;
}
@keyframes puff-up {
  0% {
    transform: translate(0, 6px) scale(0.3) rotate(0deg);
    opacity: 0;
  }
  /* 前 18% 就窜出 10px：不能贴着按钮的心磨蹭，否则看着像「重影」 */
  18% {
    transform: translate(calc(var(--dx) * 0.3), -10px) scale(1.1)
      rotate(calc(var(--rot) * 0.3));
    opacity: 1;
  }
  55% {
    transform: translate(calc(var(--dx) * 0.75), -24px) scale(0.9)
      rotate(calc(var(--rot) * 0.75));
    opacity: 0.55;
  }
  100% {
    transform: translate(var(--dx), -36px) scale(0.55) rotate(var(--rot));
    opacity: 0;
  }
}
</style>
