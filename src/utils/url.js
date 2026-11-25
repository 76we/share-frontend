/**
 * 图片地址归一化
 * ------------------------------------------------------------
 * 后端存的是相对路径（images/2024/05/x.jpg），CDN 上线后可能是
 * https://cdn.xxx/... 或协议相对的 //cdn.xxx/...，本地预览还可能是
 * blob:/data: 地址。全站所有 <img> 都从这里过一遍，只此一处实现。
 *
 * 原实现有 7 份拷贝、两种口径：
 *   - 6 处用 startsWith('http') || startsWith('//')
 *   - 2 处用 /^https?:\/\//
 * 后者遇到 //cdn.xxx/a.jpg 不认，会拼成 "///cdn.xxx/a.jpg"——协议相对
 * 地址在切换 CDN 时很常见，所以统一按下面这套规则走。
 */
export function imgUrl(url) {
  if (!url) return ''
  const s = String(url).trim()
  if (!s) return ''
  // 完整地址 / 协议相对 //host / data: / blob: 一律原样使用
  if (/^(https?:)?\/\//i.test(s) || /^(data|blob):/i.test(s)) return s
  // 裸相对路径补前导斜杠（交给 vite proxy 或 nginx 的 /images 规则）
  return s.startsWith('/') ? s : '/' + s
}

/** 在新标签页打开大图（全站统一的「点图看大图」行为） */
export function openImage(url) {
  const src = imgUrl(url)
  if (src) window.open(src, '_blank', 'noopener')
}
