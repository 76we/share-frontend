// src/utils/sharePost.js —— 发布后需要的两个小工具
import axios from 'axios'

/**
 * 发布接口只返回 Result<Void>，拿不到新动态的 id 和总篇数。
 * 这里按「最新一页里正文完全相同」反查一次，同时带出 total（用于「第 N 篇」）。
 * 失败返回 { id: null, total: null }：调用方必须能接受「没有链接」，
 * 不能因为反查失败就让发布流程报错。
 */
export async function findPosted(content) {
  const text = String(content || '').trim()
  if (!text) return { id: null, total: null }
  try {
    const res = await axios.get('/moments/list', {
      params: { page: 1, size: 5, sort: 'new' },
      silent: true,
    })
    const data = res.data?.data ?? {}
    const list = data.records ?? []
    const hit = list.find((m) => String(m.content || '').trim() === text)
    return { id: hit?.id ?? null, total: Number(data.total) || null }
  } catch (e) {
    return { id: null, total: null }
  }
}

/** 复制文本：优先 Clipboard API，非 https / 老浏览器退回 execCommand */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (e) {
    // 落到下面的兜底
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch (e) {
    return false
  }
}
