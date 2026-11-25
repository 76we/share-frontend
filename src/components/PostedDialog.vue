<!-- src/components/PostedDialog.vue —— 发布后的「入阁」确认卡
     ============================================================
     原来发布完是 router.push('/home') + 一条 2 秒消失的 toast，
     用户拿到的反馈是「界面变回去了」，而不是「我写的东西进了某个地方」。

     这里给三样东西：一个具体的归属（第 N 篇）、一个可带走的产物（存成图）、
     一个可转发的地址（复制链接）。前者是正反馈，后两者是传播载体。
     ============================================================ -->
<template>
  <Teleport to="body">
    <Transition name="pd">
      <div v-if="visible" class="pd-mask" @click.self="close">
        <div class="pd-card" role="dialog" aria-modal="true" aria-label="发布成功">
          <button class="pd-close" aria-label="关闭" @click="close">×</button>

          <div class="pd-seal">尘</div>
          <p class="pd-kicker">第 <b>{{ seq }}</b> 篇 · 已入阁</p>

          <div class="pd-body">
            <p class="pd-text">{{ content }}</p>
          </div>

          <p class="pd-date">{{ dateText }}</p>

          <div class="pd-actions">
            <button class="pd-btn pd-primary" :disabled="postering" @click="savePoster">
              {{ postering ? '生成中…' : '保存成图' }}
            </button>
            <button class="pd-btn" :disabled="!momentId" @click="copyLink">复制链接</button>
            <button class="pd-btn pd-ghost" @click="again">再写一段</button>
          </div>

          <p v-if="!momentId" class="pd-hint">这篇暂时拿不到链接，稍后可在详情页复制</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { copyText } from '../utils/sharePost'

const props = defineProps({
  visible: { type: Boolean, default: false },
  content: { type: String, default: '' },
  momentId: { type: [Number, String], default: null },
  seq: { type: Number, default: 0 },
  nickname: { type: String, default: '' },
})
const emit = defineEmits(['update:visible', 'again'])

const postering = ref(false)

const dateText = computed(() => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
})

function close() {
  emit('update:visible', false)
}

function again() {
  emit('update:visible', false)
  emit('again')
}

async function copyLink() {
  if (!props.momentId) return
  const url = `${location.origin}/detail/${props.momentId}`
  const ok = await copyText(url)
  if (ok) ElMessage.success('链接已复制')
  else ElMessage.warning('复制失败，请手动复制地址栏')
}

/* ---------------- 海报：1080×1440，与站内同一套排印 ---------------- */
const CINNABAR = '#c0523d'
const INK_1 = '#ede6d8'
const INK_3 = '#9a9280'
const INK_4 = '#7e7666'

/* 中文断行禁则：标点不能出现在行首，开引号不能留在行尾。
   不做这一步的话，「……给的那杯。」的句号会被挤到下一行开头，
   一整张海报上出现一个孤零零的「。」。 */
const NO_START = '，。、；：？！）〕］｝〉》」』】…·%.。'
const NO_END = '（〔［｛〈《「『【'

function wrapLines(ctx, text, maxWidth) {
  const lines = []
  let line = ''
  for (const ch of Array.from(String(text).replace(/\r/g, ''))) {
    if (ch === '\n') {
      lines.push(line)
      line = ''
      continue
    }
    const next = line + ch
    if (line && ctx.measureText(next).width > maxWidth) {
      if (NO_START.includes(ch)) {
        // 标点跟着上一行走（允许这一行稍微超出一点，视觉上比孤字正常）
        lines.push(next)
        line = ''
      } else if (line && NO_END.includes(line.slice(-1))) {
        // 行尾是开引号：把它一起带到下一行
        lines.push(line.slice(0, -1))
        line = line.slice(-1) + ch
      } else {
        lines.push(line)
        line = ch
      }
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

/* 由小到大尝试：短句用大字撑满画面，长文再逐档收小。
   （原来只会往小里收，一条 23 字的动态生成出来上半张是字、下半张全空。） */
const TEXT_TIERS = [
  { size: 56, lineHeight: 104, maxLines: 6 },
  { size: 46, lineHeight: 86, maxLines: 9 },
  { size: 38, lineHeight: 72, maxLines: 11 },
  { size: 32, lineHeight: 62, maxLines: 13 },
]

function fitText(ctx, text, maxWidth) {
  for (const tier of TEXT_TIERS) {
    ctx.font = `${tier.size}px "ZCOOL XiaoWei", "PingFang SC", serif`
    const lines = wrapLines(ctx, text, maxWidth)
    if (lines.length <= tier.maxLines) return { lines, ...tier }
  }
  const tier = TEXT_TIERS[TEXT_TIERS.length - 1]
  ctx.font = `${tier.size}px "ZCOOL XiaoWei", "PingFang SC", serif`
  const lines = wrapLines(ctx, text, maxWidth).slice(0, tier.maxLines)
  if (lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/.$/, '…')
  return { lines, ...tier }
}

function drawPoster() {
  const W = 1080
  const H = 1440
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')

  // 底：墨色由上到下加深，和站内壁纸一个调子
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#191411')
  g.addColorStop(0.55, '#12100e')
  g.addColorStop(1, '#0a0908')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // 细边：整张纸的界栏
  ctx.strokeStyle = 'rgba(232, 220, 200, 0.14)'
  ctx.lineWidth = 2
  ctx.strokeRect(44, 44, W - 88, H - 88)

  // 印章
  ctx.fillStyle = CINNABAR
  const sealX = 96
  const sealY = 96
  ctx.fillRect(sealX, sealY, 92, 92)
  ctx.fillStyle = '#f6efe2'
  ctx.font = '52px "Ma Shan Zheng", "ZCOOL XiaoWei", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('尘', sealX + 46, sealY + 50)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  // 站名
  ctx.fillStyle = INK_1
  ctx.font = '34px "Ma Shan Zheng", "ZCOOL XiaoWei", serif'
  ctx.fillText('尘叙阁', sealX + 122, sealY + 46)
  ctx.fillStyle = INK_4
  ctx.font = '19px "ZCOOL XiaoWei", "PingFang SC", serif'
  ctx.fillText('CHEN XU PAVILION', sealX + 124, sealY + 76)

  // 编号 · 日期
  ctx.fillStyle = INK_3
  ctx.font = '24px "ZCOOL XiaoWei", "PingFang SC", serif'
  ctx.fillText(`第 ${props.seq || 0} 篇 · ${dateText.value}`, 96, 288)

  // 朱砂短线：内容开始处的呼吸
  ctx.fillStyle = CINNABAR
  ctx.fillRect(96, 320, 62, 3)

  // 正文：在「短线之下、落款之上」的区间里垂直居中，
  // 短句才不会只剩上半张有字、下半张空着。
  const text = String(props.content || '').trim()
  const { lines, size, lineHeight } = fitText(ctx, text, W - 192)
  const areaTop = 400
  const areaBottom = H - 300
  const blockH = lines.length * lineHeight
  const startY = areaTop + Math.max(0, (areaBottom - areaTop - blockH) / 2)

  ctx.fillStyle = INK_1
  ctx.font = `${size}px "ZCOOL XiaoWei", "PingFang SC", serif`
  ctx.textBaseline = 'top'
  lines.forEach((line, i) => ctx.fillText(line, 96, startY + i * lineHeight))

  // 落款
  ctx.textBaseline = 'alphabetic'
  if (props.nickname) {
    ctx.fillStyle = INK_3
    ctx.font = '24px "ZCOOL XiaoWei", "PingFang SC", serif'
    ctx.fillText(`—— ${props.nickname}`, 96, H - 190)
  }
  ctx.fillStyle = INK_4
  ctx.font = '22px "ZCOOL XiaoWei", "PingFang SC", serif'
  ctx.fillText('把生活，写成一段可以翻阅的叙事', 96, H - 124)

  return c
}

async function savePoster() {
  if (postering.value) return
  postering.value = true
  try {
    // 字体没加载完就画，会退回系统宋体，整张海报的调子就没了
    if (document.fonts?.ready) await document.fonts.ready
    await Promise.all([
      document.fonts?.load?.('44px "ZCOOL XiaoWei"'),
      document.fonts?.load?.('34px "Ma Shan Zheng"'),
    ]).catch(() => {})

    const canvas = drawPoster()
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
    if (!blob) throw new Error('toBlob failed')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `尘叙阁-${dateText.value.replace(/\./g, '')}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  } catch (e) {
    ElMessage.warning('生成图片失败，可以先用截图代替')
  } finally {
    postering.value = false
  }
}

/* ESC 关闭 */
function onKey(e) {
  if (e.key === 'Escape' && props.visible) close()
}
watch(
  () => props.visible,
  (v) => {
    if (v) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  }
)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.pd-mask {
  position: fixed;
  inset: 0;
  z-index: 220;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(8, 7, 6, 0.68);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.pd-card {
  position: relative;
  width: 100%;
  max-width: 430px;
  padding: 34px 34px 26px;
  text-align: center;
  background: rgba(26, 22, 19, 0.96);
  border: 1px solid rgba(232, 220, 200, 0.14);
  border-radius: 14px;
  box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.9);
}

.pd-close {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 18px;
  line-height: 1;
  color: #7e7666;
  background: transparent;
  border: none;
  cursor: pointer;
}
.pd-close:hover { color: #c9c1b0; }

/* 印章：与导航里的标记同形，这里是「盖上去」的动作 */
.pd-seal {
  width: 52px;
  height: 52px;
  margin: 0 auto 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Ma Shan Zheng', 'ZCOOL XiaoWei', serif;
  font-size: 28px;
  color: #f6efe2;
  background: #c0523d;
  border-radius: 3px;
  box-shadow: 0 6px 18px -8px rgba(192, 82, 61, 0.9);
}

.pd-kicker {
  font-size: 12.5px;
  letter-spacing: 0.18em;
  color: #9a9280;
}
.pd-kicker b {
  font-weight: 500;
  color: #c0523d;
  font-variant-numeric: tabular-nums;
}

.pd-body {
  max-height: 40vh;
  overflow-y: auto;
  margin: 18px 0 12px;
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(232, 220, 200, 0.08);
  border-radius: 8px;
  text-align: left;
}
.pd-text {
  font-size: 14px;
  line-height: 1.95;
  color: #ede6d8;
  white-space: pre-wrap;
  word-break: break-word;
}

.pd-date {
  font-size: 11.5px;
  letter-spacing: 0.1em;
  color: #7e7666;
  font-variant-numeric: tabular-nums;
}

.pd-actions {
  display: flex;
  gap: 8px;
  margin-top: 22px;
}
.pd-btn {
  flex: 1;
  height: 36px;
  font-family: inherit;
  font-size: 12.5px;
  letter-spacing: 0.1em;
  color: #c9c1b0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(232, 220, 200, 0.12);
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}
.pd-btn:hover:not(:disabled) {
  color: #ede6d8;
  border-color: rgba(232, 220, 200, 0.26);
}
.pd-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pd-primary {
  color: #f6efe2;
  background: #c0523d;
  border-color: transparent;
}
.pd-primary:hover:not(:disabled) { background: #cb5e48; border-color: transparent; }
.pd-ghost {
  background: transparent;
  border-color: transparent;
  color: #7e7666;
}
.pd-ghost:hover:not(:disabled) { color: #c9c1b0; border-color: transparent; }

.pd-hint {
  margin-top: 12px;
  font-size: 11.5px;
  color: #6d665a;
}

/* 出入场：从下方 8px 浮起，克制一点，别像营销弹窗 */
.pd-enter-active,
.pd-leave-active { transition: opacity 0.22s ease; }
.pd-enter-from,
.pd-leave-to { opacity: 0; }
.pd-enter-active .pd-card,
.pd-leave-active .pd-card { transition: transform 0.22s ease; }
.pd-enter-from .pd-card,
.pd-leave-to .pd-card { transform: translateY(10px); }

@media (max-width: 480px) {
  .pd-card { padding: 28px 22px 20px; }
  .pd-actions { flex-wrap: wrap; }
  .pd-btn { flex: 1 1 40%; }
}
</style>
