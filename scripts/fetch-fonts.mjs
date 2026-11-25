#!/usr/bin/env node
/**
 * 把 Google Fonts 的中文字体抓成本地文件（一次性运行，产物提交进仓库）。
 *
 * 为什么要自托管：
 *   fonts.googleapis.com 在国内基本连不上，浏览器会一直等到超时才退回系统字体，
 *   结果就是首屏先用系统字体渲染、几秒后再"跳"成小薇 —— 既是 FOUT，也白等一次超时。
 *
 * 为什么保留分片而不是合成一个大文件：
 *   CJK 字库单个 ttf 是 4–8MB，压成一个 woff2 也有好几 MB，移动端首屏直接吃掉几十秒。
 *   Google 已经按 unicode-range 切成上百片，浏览器只下载页面上真实用到的那些
 *   （通常 5–15 片、合计 100–400KB），这正是我们要的粒度。
 *
 * 用法：
 *   node scripts/fetch-fonts.mjs
 * 产物：
 *   public/fonts/<family>/<google 原始文件名>.woff2
 *   src/fonts.css   —— 由 index.html 之前的 Google <link> 改为本地引入
 */
import { mkdir, writeFile, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 只保留站内实际会用到的两个字族；新增字体在这里追加 */
const FAMILIES = [
  { query: 'Ma+Shan+Zheng', slug: 'mashanzheng' },
  { query: 'ZCOOL+XiaoWei', slug: 'zcoolxiaowei' },
]

/** 固定现代 Chrome 的 UA：Google 按 UA 决定返回 woff2 还是 ttf，不固定就不可复现 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const familyQuery = FAMILIES.map((f) => `family=${f.query}`).join('&')
const CSS_URL = `https://fonts.googleapis.com/css2?${familyQuery}&display=swap`

async function main() {
  const res = await fetch(CSS_URL, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`拉取 CSS 失败：HTTP ${res.status}`)
  const css = await res.text()

  // 清掉上一次的产物，避免字体换版本后旧文件留在仓库里
  await rm(join(ROOT, 'public/fonts'), { recursive: true, force: true })

  let totalBytes = 0
  let fileCount = 0
  const usedNames = new Set()

  /** @font-face 块里没有嵌套花括号，用 [^}]+ 足够 */
  const blocks = css.match(/@font-face\s*\{[^}]+\}/g) ?? []
  if (blocks.length === 0) throw new Error('CSS 里没有解析到 @font-face')

  const rewritten = []
  for (const block of blocks) {
    const urlMatch = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)
    if (!urlMatch) {
      // 理论上不会发生；保留原块以便人工发现
      rewritten.push(block)
      continue
    }
    const srcUrl = urlMatch[1]

    // gstatic 的路径形如 /s/mashanzheng/v18/xxxx.5.woff2，家族名就在第 2 段
    const familyDir = srcUrl.split('/')[4]
    const slug = FAMILIES.find((f) => f.slug === familyDir || familyDir.startsWith(f.slug.slice(0, 6)))?.slug
    if (!slug) throw new Error(`未知字体目录：${familyDir}（${srcUrl}）`)

    const fileName = srcUrl.split('/').pop()
    const relPath = `${slug}/${fileName}`
    if (!usedNames.has(relPath)) {
      usedNames.add(relPath)
      const bin = Buffer.from(await (await fetch(srcUrl, { headers: { 'User-Agent': UA } })).arrayBuffer())
      const out = join(ROOT, 'public/fonts', relPath)
      await mkdir(dirname(out), { recursive: true })
      await writeFile(out, bin)
      totalBytes += bin.length
      fileCount += 1
      if (fileCount % 20 === 0) console.log(`  已下载 ${fileCount} 个分片…`)
    }

    rewritten.push(block.replace(srcUrl, `/fonts/${relPath}`))
  }

  const header = `/* 自动生成，请勿手改 —— 重新生成：node scripts/fetch-fonts.mjs
   字体：Ma Shan Zheng（毛笔标题）、ZCOOL XiaoWei（正文）
   源：${CSS_URL}
   共 ${fileCount} 个分片、${(totalBytes / 1024 / 1024).toFixed(2)} MB（浏览器只下载命中字符的片） */\n\n`
  await writeFile(join(ROOT, 'src/fonts.css'), header + rewritten.join('\n\n') + '\n')

  console.log(`完成：${fileCount} 个 woff2，合计 ${(totalBytes / 1024).toFixed(0)} KB`)
  console.log(`CSS 写入 src/fonts.css（${(header.length + rewritten.join('').length) / 1024 | 0} KB 量级）`)

  const files = await readdir(join(ROOT, 'public/fonts'))
  console.log(`目录：public/fonts/${files.join(', ')}`)
}

main().catch((e) => {
  console.error('失败：', e.message)
  process.exit(1)
})
