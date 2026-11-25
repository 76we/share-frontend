<!-- src/components/MomentCard.vue —— 动态卡片（全站唯一实现）
     ============================================================
     原来首页 / 个人中心 / 话题页各有一套卡片模板，三份 <img> 循环、
     三份「头像 + 昵称 + 时间」、三份点赞收藏行，改一处要动三个文件，
     还漏改过两次（alt 文案、作者跳转）。

     现在一套骨架 + 两套皮肤，由 variant 决定：
       feed —— 首页信息流（墨色玻璃、首条带图左文右图、纯文字短句卡）
       ink  —— 个人中心 / 话题页（nr-card 纸页卡，可选右上角序号）

     皮肤差异全部落在 CSS 里（--m-* 变量由首页根节点提供，ink 用全局
     --card-* 变量），模板里只有文案上的两处小差别（地点/心情标签）。

     为什么不做成「一个皮肤 + CSS 覆盖」：两套卡片排版模型不同（feed 是
     网格，ink 是普通块流），硬合并会让两边都写一堆 reset，反而更难维护。
     ============================================================ -->
<template>
  <article
    class="mcard"
    role="link"
    tabindex="0"
    :class="[
      `mcard--${variant}`,
      variant === 'feed' ? 'post' : 'nr-card',
      {
        'is-featured': isFeatured,
        'is-short': isShort,
      },
    ]"
    @click="openDetail"
    @keydown.enter.prevent="openDetail"
  >
    <!-- 序号：只在话题页这类「卷内条目」场景出现 -->
    <span v-if="index !== null && variant === 'ink'" class="mcard-index" aria-hidden="true">
      {{ index + 1 < 10 ? '0' + (index + 1) : index + 1 }}
    </span>

    <!-- 作者 -->
    <div
      class="mcard-author"
      :title="'看看 ' + (m.nickname || 'TA') + ' 的主页'"
      @click.stop="openAuthor"
    >
      <UserAvatar class="mcard-avatar" :src="imgUrl(m.avatar)" :name="m.nickname" />
      <span class="mcard-name">{{ variant === 'feed' ? (m.nickname || '无名氏') : m.nickname }}</span>
      <span class="mcard-time">{{ formatTime(m.createTime) }}</span>
    </div>

    <!-- 标题 + 正文 -->
    <h2 v-if="m.title" class="mcard-title">{{ m.title }}</h2>
    <p class="mcard-text">{{ m.content }}</p>

    <!-- 图片 -->
    <div v-if="imgs.length" class="mcard-imgs" :class="'imgs-' + Math.min(imgs.length, 9)">
      <template v-if="isFeatured">
        <img
          class="mcard-img mcard-img--lead"
          :src="imgUrl(imgs[0])"
          :alt="m.title || '动态图片'"
          loading="lazy"
          @click.stop="preview(0)"
        />
        <span v-if="imgs.length > 1" class="mcard-more">+{{ imgs.length - 1 }}</span>
      </template>
      <template v-else>
        <img
          v-for="(img, i) in imgs"
          :key="i"
          class="mcard-img"
          :src="imgUrl(img)"
          :alt="m.title || '动态图片'"
          loading="lazy"
          @click.stop="preview(i)"
        />
      </template>
    </div>

    <!-- 地点 / 心情 + 互动 -->
    <div class="mcard-meta">
      <!-- 个人中心要在卡片里塞「编辑 / 删除」，位置固定在 meta 行首 -->
      <slot name="meta-extra" />

      <template v-if="variant === 'feed'">
        <span v-if="m.location" class="mcard-chip">{{ m.location }}</span>
        <span v-if="m.mood" class="mcard-chip mcard-chip--mood">{{ m.mood }}</span>
      </template>
      <template v-else>
        <span v-if="m.location" class="mcard-chip">📍 {{ m.location }}</span>
        <span v-if="m.mood" class="mcard-chip">心情 · {{ m.mood }}</span>
      </template>

      <span class="mcard-stats">
        <LikeButton :targetId="m.id" :targetType="1" :initial="m.likeCount ?? 0" />
        <span class="mcard-comment">✎ {{ m.commentCount ?? 0 }}</span>
        <CollectButton :momentId="m.id" :initial="m.collectCount ?? 0" />
      </span>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import LikeButton from './LikeButton.vue'
import CollectButton from './CollectButton.vue'
import UserAvatar from './UserAvatar.vue'
import { imgUrl, openImage } from '../utils/url'
import { formatTime } from '../utils/format'

const props = defineProps({
  moment: { type: Object, required: true },
  /** feed = 首页信息流皮肤；ink = 个人中心 / 话题页纸页卡 */
  variant: { type: String, default: 'feed' },
  /** 首条带图时左文右图（仅 feed 皮肤生效） */
  featured: { type: Boolean, default: false },
  /** 卷内序号，0 起；null 表示不显示（仅 ink 皮肤生效） */
  index: { type: Number, default: null },
})

const router = useRouter()
const m = computed(() => props.moment || {})
const imgs = computed(() => (Array.isArray(m.value.images) ? m.value.images : []))

/* 首条带图才做「左文右图」；没有图时套这个骨架会在右侧留一块空白 */
const isFeatured = computed(() => props.variant === 'feed' && props.featured && imgs.value.length > 0)

/* 短句：无标题、无图、50 字以内。这类内容套长文骨架（18px 标题位 +
   四行正文 + 分隔线）看着像没写完，给它一种更松的排布。 */
const isShort = computed(() => {
  const c = m.value
  if (props.variant !== 'feed' || c.title || imgs.value.length) return false
  const n = (c.content || '').trim().length
  return n > 0 && n <= 50
})

function openDetail() {
  if (m.value.id == null) return
  router.push(`/detail/${m.value.id}`)
}

function openAuthor() {
  const uid = m.value.userId
  if (uid == null) return
  router.push(`/profile/${uid}`)
}

function preview(i) {
  openImage(imgs.value[i])
}
</script>

<style scoped>
/* ============================================================
   两套皮肤共用：只放「与视觉无关」的行为，颜色/字号/间距一律写进
   各自的 variant 段，避免一份样式意外漏到另一套卡上（踩过：漏加
   `.mcard--feed` 前缀，line-height 1.55 泄进话题页标题、图片被压成 260px）。
   ============================================================ */
.mcard { cursor: pointer; }
/* 卡片整体可点击，但键盘也要能用 Tab 走到、回车打开（原来只有鼠标能进详情） */
.mcard:focus-visible {
  outline: 2px solid var(--m-cinnabar);
  outline-offset: 2px;
}
.mcard--ink:focus-visible { outline-color: var(--c-gold); }
.mcard-stats {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

/* ============================================================
   皮肤 A：feed —— 首页信息流
   材质与色值来自首页根节点上的 --m-* 变量，组件内不写第二个色值。
   ============================================================ */
.mcard--feed {
  padding: 22px 24px;
  margin-bottom: 16px;
  background: var(--m-card);
  border: 1px solid var(--m-line);
  border-radius: 10px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.055),
    0 10px 26px -16px rgba(0, 0, 0, 0.75);
  transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
}
.mcard--feed:hover {
  background: var(--m-card-hover);
  border-color: var(--m-line-2);
  transform: translateY(-2px);
}

.mcard--feed .mcard-author {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 13px;
}
.mcard--feed .mcard-avatar {
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.08);
}
.mcard--feed .mcard-name {
  font-size: 13px;
  color: var(--m-ink-2);
  transition: color 0.2s ease;
}
.mcard--feed .mcard-author:hover .mcard-name { color: var(--m-cinnabar); }
.mcard--feed .mcard-time {
  margin-left: auto;
  font-size: 12px;
  color: var(--m-ink-4);
}

.mcard--feed .mcard-title {
  font-size: 18px;
  font-weight: 500;
  line-height: 1.55;
  letter-spacing: 0.02em;
  color: var(--m-ink-1);
  margin-bottom: 8px;
}
.mcard--feed .mcard-text {
  font-size: 14px;
  line-height: 1.9;
  color: var(--m-ink-2);
  white-space: pre-wrap;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
}

/* 短句卡：放大、放松、去掉标题位 */
.mcard--feed.is-short { padding: 26px 28px 22px; }
.mcard--feed.is-short .mcard-author { margin-bottom: 15px; }
.mcard--feed.is-short .mcard-text {
  font-size: 17px;
  line-height: 2.05;
  color: var(--m-ink-1);
  letter-spacing: 0.01em;
  -webkit-line-clamp: 3;
}
/* 一句话的卡片不需要那条分隔线，否则横线把卡片切成两半 */
.mcard--feed.is-short .mcard-meta {
  margin-top: 12px;
  padding-top: 0;
  border-top: none;
}

/* 头条卡：左文右图，图跨满所有行随卡片高度拉伸 */
.mcard--feed.is-featured {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
  grid-template-rows: auto auto auto 1fr auto;
  column-gap: 24px;
  padding: 22px 24px;
}
.mcard--feed.is-featured .mcard-author { grid-column: 1; grid-row: 1; }
.mcard--feed.is-featured .mcard-title { grid-column: 1; grid-row: 2; font-size: 20px; }
.mcard--feed.is-featured .mcard-text {
  grid-column: 1;
  grid-row: 3;
  -webkit-line-clamp: 5;
}
.mcard--feed.is-featured .mcard-meta {
  grid-column: 1;
  grid-row: 5;
  align-self: end;
  margin-top: 18px;
}
.mcard--feed.is-featured .mcard-imgs {
  grid-column: 2;
  grid-row: 1 / -1;
  display: block;
  margin-top: 0;
  position: relative;
  border-radius: 7px;
  overflow: hidden;
}
.mcard--feed.is-featured .mcard-img--lead {
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  min-height: 190px;
  object-fit: cover;
  border-radius: 7px;
}
.mcard--feed .mcard-more {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 2px 8px;
  font-size: 12px;
  color: #f0e9dc;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 4px;
  pointer-events: none;
}

/* 普通卡图片网格：六列栅格，按张数决定占几列 */
.mcard--feed .mcard-imgs {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 5px;
  margin-top: 13px;
}
.mcard--feed .mcard-img {
  width: 100%;
  grid-column: span 2;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 5px;
  cursor: zoom-in;
  background: rgba(255, 255, 255, 0.05);
  transition: opacity 0.2s ease;
}
.mcard--feed .mcard-img:hover { opacity: 0.9; }
/* 单图 / 三图首图给高度上限，否则一张 2:1 的图能到 350px */
.mcard--feed .imgs-1 .mcard-img { grid-column: span 6; aspect-ratio: 16 / 8; max-height: 260px; }
.mcard--feed .imgs-2 .mcard-img { grid-column: span 3; aspect-ratio: 4 / 3; }
.mcard--feed .imgs-3 .mcard-img:first-child { grid-column: span 6; aspect-ratio: 16 / 8; max-height: 240px; }
.mcard--feed .imgs-3 .mcard-img:not(:first-child) { grid-column: span 3; aspect-ratio: 4 / 3; }
.mcard--feed .imgs-4 .mcard-img { grid-column: span 3; aspect-ratio: 4 / 3; }

.mcard--feed .mcard-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 13px;
  padding-top: 11px;
  border-top: 1px solid var(--m-line);
}
.mcard--feed .mcard-chip {
  padding: 2px 9px;
  font-size: 12px;
  color: var(--m-ink-3);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--m-line);
  border-radius: 4px;
}
.mcard--feed .mcard-chip--mood {
  color: #d8c891;
  background: rgba(201, 162, 39, 0.1);
  border-color: rgba(201, 162, 39, 0.24);
}
.mcard--feed .mcard-comment {
  font-size: 12px;
  color: var(--m-ink-4);
}
.mcard--feed .mcard-stats :deep(.like-btn) { font-size: 12px; }
.mcard--feed .mcard-stats :deep(.like-btn.liked) { color: var(--m-cinnabar); }
.mcard--feed .mcard-stats :deep(.collect-btn.collected) { color: var(--m-gold); }

/* ============================================================
   皮肤 B：ink —— 个人中心 / 话题页
   底、边框、投影、圆角由全局 .nr-card 提供（模板上挂了 nr-card 类），
   这里只补卡片内部排版；色值走全局 --txt-* / --c-gold* 变量。
   ============================================================ */
.mcard--ink {
  position: relative;
  padding: 20px 22px;
}
.mcard--ink .mcard-author {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 0;
}
.mcard--ink .mcard-avatar {
  grid-row: span 2;
  align-self: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--c-gold-dim);
  background: var(--fill);
  object-fit: cover;
}
.mcard--ink .mcard-name {
  grid-column: 2;
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--txt-1);
  transition: color 0.2s ease;
}
.mcard--ink .mcard-author:hover .mcard-name { color: var(--c-gold); }
.mcard--ink .mcard-time {
  grid-column: 2;
  margin-top: 2px;
  font-size: 11px;
  color: var(--txt-3);
}

.mcard--ink .mcard-title {
  font-family: var(--font-brush);
  font-size: 22px;
  font-weight: 400;
  line-height: normal;
  letter-spacing: 2px;
  color: #f0f0f0;
  margin: 14px 0 6px;
}
.mcard--ink .mcard-text {
  display: block;
  font-size: 13px;
  line-height: 1.8;
  color: var(--txt-2);
  margin: 8px 0;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: visible;
}
.mcard--ink .mcard-imgs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 12px 0;
}
.mcard--ink .imgs-1 { grid-template-columns: 1fr; max-width: 360px; }
.mcard--ink .imgs-4 { grid-template-columns: repeat(2, 1fr); }
.mcard--ink .mcard-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 2px;
  border: 1px solid var(--card-border);
  cursor: zoom-in;
}
.mcard--ink .mcard-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--txt-3);
}
.mcard--ink .mcard-chip {
  padding: 3px 10px;
  border: 1px solid var(--card-border);
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.02);
}

.mcard-index {
  position: absolute;
  top: 16px;
  right: 20px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--c-gold-faint);
  opacity: 0.5;
}

/* ==================== 响应式（feed 皮肤） ==================== */
@media (max-width: 760px) {
  /* 手机上所有卡片统一内边距：短句卡在 390 宽下按 28px 左右内距只剩
     300 出头，一行放不下 12 个汉字，反而比长文卡更挤 */
  .mcard--feed,
  .mcard--feed.is-short { padding: 18px 16px; }
  .mcard--feed.is-featured {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto;
  }
  .mcard--feed.is-featured .mcard-author,
  .mcard--feed.is-featured .mcard-title,
  .mcard--feed.is-featured .mcard-text,
  .mcard--feed.is-featured .mcard-meta,
  .mcard--feed.is-featured .mcard-imgs {
    grid-column: 1;
    grid-row: auto;
  }
  .mcard--feed.is-featured .mcard-imgs { margin-top: 13px; }
  .mcard--feed.is-featured .mcard-img--lead {
    min-height: 0;
    aspect-ratio: 16 / 10;
    height: auto;
  }
  .mcard--feed .mcard-title { font-size: 16px; }
  .mcard--feed.is-featured .mcard-title { font-size: 17px; }
  .mcard--feed .imgs-1 .mcard-img { max-height: 240px; }
}

@media (prefers-reduced-motion: reduce) {
  .mcard--feed { transition: none; }
  .mcard--feed:hover { transform: none; }
}
</style>
