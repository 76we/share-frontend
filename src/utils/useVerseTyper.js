/* src/utils/useVerseTyper.js —— 诗句轮播打字机 composable
   风格：与品牌标语「偶拾尘间景，聊寄心上言」一致——5+5 对仗，
        上句写景/叙事，下句抒怀，洒脱随性，像在闲叙一段个人经历。
   效果：逐字写出 → 停留 → 逐字抹去 → 换下一句，循环往复。 */

import { ref, onMounted, onUnmounted } from 'vue'

/* 轮播诗句集——每句都是一段"尘间小事 + 心上闲话" */
export const VERSES = [
  '偶拾尘间景，聊寄心上言', // 品牌标语（首句保留）
  '且将浮生事，说与晚风听',
  '掬一捧清辉，慰半世风尘',
  '行过千山雪，归来话旧年',
  '浮生皆逆旅，此处可停舟',
  '山河皆入卷，心事付流云',
]

/**
 * 诗句轮播打字机
 * @param {Object} opt 时序配置（毫秒）
 *   typeDelay  逐字写出的间隔
 *   holdDelay  整句写完后的停留
 *   eraseDelay 逐字抹去的间隔
 *   gapDelay   抹完到下一句开始的停顿
 * @returns {{ typed: import('vue').Ref<string> }} 当前显示的文字（响应式）
 */
export function useVerseTyper(opt = {}) {
  const {
    typeDelay = 150,
    holdDelay = 2000,
    eraseDelay = 70,
    gapDelay = 420,
  } = opt

  const typed = ref('')
  let timer = null
  let verseIdx = 0   // 当前诗句
  let charIdx = 0    // 当前字数
  let phase = 'typing' // typing | holding | erasing | gap

  function schedule(fn, ms) {
    timer = setTimeout(fn, ms)
  }

  function step() {
    const verse = VERSES[verseIdx]
    if (phase === 'typing') {
      typed.value = verse.slice(0, ++charIdx)
      if (charIdx >= verse.length) {
        phase = 'holding'
        schedule(step, holdDelay)
      } else {
        schedule(step, typeDelay)
      }
    } else if (phase === 'holding') {
      phase = 'erasing'
      schedule(step, eraseDelay)
    } else if (phase === 'erasing') {
      typed.value = verse.slice(0, --charIdx)
      if (charIdx <= 0) {
        verseIdx = (verseIdx + 1) % VERSES.length
        phase = 'gap'
        schedule(step, gapDelay)
      } else {
        schedule(step, eraseDelay)
      }
    } else if (phase === 'gap') {
      phase = 'typing'
      schedule(step, typeDelay)
    }
  }

  onMounted(() => {
    // 尊重系统"减少动态效果"：直接显示首句，不做轮播
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      typed.value = VERSES[0]
      return
    }
    schedule(step, 500) // 首屏稍等再开始
  })

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return { typed }
}
