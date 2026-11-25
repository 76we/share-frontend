/**
 * 时间显示
 * ------------------------------------------------------------
 * 后端返回 ISO 串或 "2026-09-03 14:05:00"，这里统一解析；
 * 解析不了的原样吐回（后端偶发返回空/非法值时不要把 NaN 显示给用户）。
 * 之前 formatTime 在 5 个页面各抄了一份，格式分两种（月日 / 完整日期），
 * 现在保留两种语义、一个实现。
 */
const pad2 = (n) => (n < 10 ? '0' + n : String(n))

function toDate(t) {
  if (!t) return null
  const d = t instanceof Date ? t : new Date(t)
  return isNaN(d.getTime()) ? null : d
}

/** 9月3日 14:05 —— 列表卡片用 */
export function formatTime(t) {
  if (!t) return ''
  const d = toDate(t)
  if (!d) return String(t)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 2026-09-03 14:05 —— 详情页用（需要确切年份） */
export function formatDateTime(t) {
  if (!t) return ''
  const d = toDate(t)
  if (!d) return String(t)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** 14:05:06 —— 秒级时钟 */
export function formatClock(d = new Date()) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}
