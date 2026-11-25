/* src/utils/compressImage.js —— 上传前把图片压到「够用就好」
   为什么需要：手机直出照片单张 3–4MB，最多 9 张就是 30MB+。
   4G 上传要几十秒，弱网直接超时；后端虽然有 5MB/张的限制，
   但用户只会看到「超过 5MB，请压缩后再传」——他没工具可压。

   策略：长边缩到 1600px（与后端 FileUtil 的原图上限一致，再大也会被后端重缩），
   JPEG q0.82。实测 4032×3024 / 3.8MB 的样图 → 1600×1200 / 约 320KB，肉眼无差。

   三个容易踩的坑，这里都处理了：
   1. EXIF 方向。手机竖拍的照片，像素其实是横的，方向存在 EXIF Orientation 里。
      直接 drawImage 会得到一张躺倒的图。用 createImageBitmap(..., { imageOrientation: 'from-image' })
      让浏览器先按 EXIF 转正再画。
   2. 透明 PNG。canvas 默认透明，转 JPEG 时透明区会变纯黑。先铺一层白底。
   3. 内存。9 张 4000×3000 的图同时解码 ≈ 400MB，移动端会直接崩。
      所以 compressImages() 是串行的，一次只解一张。
*/

/** 长边上限（px） */
const MAX_EDGE = 1600
/** JPEG 质量 */
const QUALITY = 0.82
/** 小于这个体积、且没超尺寸的 JPEG 原样上传：重编码只会掉画质、体积也不会更小 */
const SKIP_BYTES = 800 * 1024
/** 只处理位图；gif 会丢帧、svg 是矢量，都不碰 */
const ACCEPT = /^image\/(jpeg|png|webp|bmp)$/i

/** 解码：优先 createImageBitmap（快、不占 DOM），失败回退 <img> */
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation: 'from-image' 会按 EXIF 把图转正；
      // 老浏览器不认这个参数时会忽略，而不是报错。
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch (e) {
      // 落到下面的 <img> 兜底
    }
  }
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片解码失败'))
    }
    img.src = url
  })
}

/** 等比例缩到长边 maxEdge 以内；本来就小的不放大 */
function fitSize(w, h, maxEdge) {
  const longEdge = Math.max(w, h)
  if (longEdge <= maxEdge) return { w, h }
  const scale = maxEdge / longEdge
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

/** canvas → Blob（toBlob 在极老浏览器没有，退回 dataURL） */
function toBlob(canvas, quality) {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
      return
    }
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const bin = atob(dataUrl.split(',')[1])
    const buf = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
    resolve(new Blob([buf], { type: 'image/jpeg' }))
  })
}

/** 换扩展名：压缩后一律是 jpeg，名字也跟着改，避免 a.png 里装着 jpeg 数据 */
function jpegName(name) {
  const base = String(name || 'image').replace(/\.[^.]+$/, '')
  return `${base}.jpg`
}

/**
 * 压缩单张图片。
 * 任何一步失败都返回原文件——压缩只是为了快，不能因为它发不出去。
 * @param {File} file
 * @param {{ maxEdge?: number, quality?: number, skipBytes?: number, force?: boolean }} [options]
 * @returns {Promise<File>}
 */
export async function compressImage(file, options = {}) {
  const {
    maxEdge = MAX_EDGE,
    quality = QUALITY,
    skipBytes = SKIP_BYTES,
    force = false,
  } = options

  if (!file || !file.size) return file
  if (!ACCEPT.test(file.type || '')) return file

  // 小 JPEG 直接放行：没超尺寸就不必再解一次码
  if (!force && file.type === 'image/jpeg' && file.size <= skipBytes) {
    return file
  }

  let bitmap = null
  try {
    bitmap = await decode(file)
    const srcW = bitmap.width || bitmap.naturalWidth
    const srcH = bitmap.height || bitmap.naturalHeight
    if (!srcW || !srcH) return file

    const { w, h } = fitSize(srcW, srcH, maxEdge)

    // 没缩尺寸、体积也不大、还是 jpeg：压了只会更糊，直接返回
    if (!force && w === srcW && h === srcH && file.size <= skipBytes) return file

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    // 透明 PNG 转 JPEG 会变黑底，先铺白
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await toBlob(canvas, quality)
    if (!blob) return file

    // 压完反而更大（原本就是高质量小图），保留原文件
    if (blob.size >= file.size && w === srcW && h === srcH) return file

    return new File([blob], jpegName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified || Date.now(),
    })
  } catch (e) {
    return file
  } finally {
    // ImageBitmap 占的是原生内存，必须显式释放
    if (bitmap && typeof bitmap.close === 'function') bitmap.close()
  }
}

/**
 * 串行压缩一组图片（并发解码会撑爆移动端内存）。
 * @param {File[]} files
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<File[]>}
 */
export async function compressImages(files, onProgress) {
  const list = Array.from(files || [])
  const out = []
  for (let i = 0; i < list.length; i++) {
    out.push(await compressImage(list[i]))
    if (onProgress) onProgress(i + 1, list.length)
  }
  return out
}

/** 未压缩时给个预估，用于提示「30MB → 3MB」这类文案 */
export function totalSize(files) {
  return Array.from(files || []).reduce((n, f) => n + (f?.size || 0), 0)
}

/** 字节数转可读体积 */
export function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
