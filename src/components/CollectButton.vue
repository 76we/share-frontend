<!-- src/components/CollectButton.vue —— 通用收藏按钮
     对接后端 /collects 三接口：挂载时拉真实收藏数与"我是否已收藏"，点击切换。
     props:
       momentId Number 必填  动态id
       initial  Number       后端列表/详情里带的 collectCount（首屏占位，随后用 /count 覆盖）
     emits: change({ collected, count }) -->
<template>
  <span
    class="collect-btn"
    :class="{ collected: collected, busy: busy }"
    :title="logged ? (collected ? '取消收藏' : '收藏') : '登录后收藏'"
    @click.stop="onToggle"
  >
    <span class="star">{{ collected ? '★' : '☆' }}</span>
    <span class="num">{{ count }}</span>
  </span>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getCollectCount, getCollectState, toggleCollect } from '../utils/collectApi'

const props = defineProps({
  momentId: { type: Number, required: true },
  initial: { type: Number, default: 0 },
})
const emit = defineEmits(['change'])

const logged = ref(!!localStorage.getItem('token'))
const collected = ref(false)
const count = ref(props.initial)
const busy = ref(false)

onMounted(async () => {
  try {
    count.value = await getCollectCount(props.momentId)
  } catch (e) { /* 保留 initial 兜底 */ }

  if (logged.value) {
    try {
      collected.value = await getCollectState(props.momentId)
    } catch (e) { /* 401 等保持未收藏 */ }
  }
})

async function onToggle() {
  if (busy.value) return
  if (!logged.value) {
    ElMessage.warning('请先登录后再收藏')
    return
  }
  busy.value = true
  try {
    const op = await toggleCollect(props.momentId)
    if (op === 1) {
      collected.value = true
      count.value = Math.max(0, count.value + 1)
    } else if (op === -1) {
      collected.value = false
      count.value = Math.max(0, count.value - 1)
    }
    emit('change', { collected: collected.value, count: count.value })
  } catch (e) {
    // 错误提示由 main.js 响应拦截器统一弹出
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.collect-btn {
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
.collect-btn:hover {
  color: var(--txt-1);
}
.collect-btn.collected {
  color: var(--c-gold); /* 淡金，配合暗色玄幻风 */
}
.collect-btn.busy {
  opacity: 0.6;
  pointer-events: none;
}
.collect-btn:active {
  transform: scale(0.92);
}
.star {
  font-size: 15px;
  line-height: 1;
}
</style>
