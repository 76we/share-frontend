<!-- src/components/CommentNode.vue —— 递归评论节点
     渲染单条评论 + 缩进的子回复树
     props: comment(CommentVO) / level(0=一级，>=1 为子回复) / canDelete
     emits: reply(点击"回复"，传 comment 与 level) / delete(点击删除) -->
<template>
  <div class="comment-node" :class="{ 'is-top': level === 0 }">
    <!-- 当前评论 -->
    <div class="c-body">
      <img class="c-avatar" :src="imgUrl(comment.commentAvatar)" alt="avatar" />
      <div class="c-main">
        <div class="c-line1">
          <span class="c-name">{{ comment.commentUsername }}</span>
          <!-- 子回复时展示"回复 @xxx" -->
          <span class="c-reply-to" v-if="level > 0 && comment.replyUsername">
            回复 <b>@{{ comment.replyUsername }}</b>
          </span>
          <span class="c-time">{{ formatTime(comment.createTime) }}</span>
        </div>
        <p class="c-content">{{ comment.content }}</p>
        <div class="c-actions">
          <LikeButton :targetId="comment.id" :targetType="2" :initial="comment.likeCount ?? 0" />
          <span
            class="c-action-link"
            @click="$emit('reply', comment, level)"
          >回复</span>
          <span
            class="c-action-link c-del"
            v-if="canDelete(comment)"
            @click="$emit('delete', comment.id)"
          >删除</span>
        </div>
      </div>
    </div>

    <!-- 子回复：缩进递归（canDelete 函数随节点下传） -->
    <div class="c-children" v-if="comment.children?.length">
      <CommentNode
        v-for="child in comment.children"
        :key="child.id"
        :comment="child"
        :level="level + 1"
        :canDelete="canDelete"
        @reply="(c) => $emit('reply', c, level + 1)"
        @delete="(id) => $emit('delete', id)"
      />
    </div>
  </div>
</template>

<script setup>
// <script setup> 组件可通过文件名自引用（CommentNode），无需显式导入，
// 这样递归同步渲染，避免异步加载导致的闪烁与构建警告。

import LikeButton from './LikeButton.vue'

defineProps({
  comment: { type: Object, required: true },   // CommentVO
  level: { type: Number, default: 0 },
  // 删除权限判断函数：(comment) => boolean，由 Detail 传入并随递归下传
  canDelete: { type: Function, required: true },
})

defineEmits(['reply', 'delete'])

function imgUrl(img) {
  if (!img) return ''
  if (img.startsWith('http') || img.startsWith('//')) return img
  return img.startsWith('/') ? img : '/' + img
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t)
  const p = (n) => (n < 10 ? '0' + n : n)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<style scoped>
.comment-node.is-top {
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.comment-node.is-top:last-child {
  border-bottom: none;
}
/* 子回复整体缩进 */
.c-children {
  margin-left: 48px;
}

.c-body {
  display: flex;
  gap: 12px;
}

.c-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--card-border);
  background: rgba(255, 255, 255, 0.05);
}

.c-main {
  flex: 1;
  min-width: 0;
}

.c-line1 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.c-name {
  font-size: 14px;
  letter-spacing: 1px;
  color: var(--txt-1);
}
.c-reply-to {
  font-size: 12px;
  color: var(--txt-3);
}
.c-reply-to b {
  color: #e8d9b5;
  font-weight: 400;
}
.c-time {
  margin-left: auto;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--txt-3);
}

.c-content {
  margin-top: 4px;
  font-size: 14px;
  line-height: 1.8;
  letter-spacing: 1px;
  color: var(--txt-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.c-actions {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.c-action-link {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--txt-3);
  cursor: pointer;
  transition: color 0.2s;
}
.c-action-link:hover {
  color: var(--txt-1);
}
.c-del:hover {
  color: #f56c6c;
}
</style>
