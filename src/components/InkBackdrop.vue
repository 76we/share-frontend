<!-- src/components/InkBackdrop.vue —— 水墨动态壁纸背景
     做法说明：
     底图是一张静态水墨图（public/ink-cloud.jpg，207KB），
     靠四层叠加让它"动"起来：
       ① 底图层  极慢的推镜（60s 缩放 + 平移，肉眼察觉不到在动，只觉得"活"）
       ② 雾层 A  一层淡白云雾横向漂移（38s）
       ③ 雾层 B  更大范围的云影反向漂移（52s），与 A 交错就形成流动感
       ④ 朱砂层  画面一处极淡的朱砂光晕缓慢呼吸（14s）
     相比视频壁纸：体积小十倍、无循环接缝、不需要解码、移动端不烫手。
     若以后要换成真视频，把 <img> 层换成 <video> 即可，其余层可保留。 -->
<template>
  <div
    class="ink-backdrop"
    :class="{ 'is-paused': paused }"
    :style="{ '--ink-src': `url(${src})`, '--ink-dim': dim }"
    aria-hidden="true"
  >
    <div class="ink-layer ink-image"></div>
    <div class="ink-layer ink-fog-a"></div>
    <div class="ink-layer ink-fog-b"></div>
    <div class="ink-layer ink-ember"></div>
    <div class="ink-layer ink-vignette"></div>
  </div>
</template>

<script setup>
defineProps({
  /** 底图地址，放 public 目录即可用绝对路径 */
  src: { type: String, default: '/ink-cloud.jpg' },
  /** 底图亮度，越小越暗（登录页文字少可以 0.6，首页信息流建议 0.4 左右） */
  dim: { type: Number, default: 0.62 },
  /** 传入 true 时暂停全部图层动画，用于页面滚出视口后省电 */
  paused: { type: Boolean, default: false },
})
</script>

<style scoped>
.ink-backdrop.is-paused .ink-layer {
  animation-play-state: paused !important;
}
.ink-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #0b0b0c;
  /* 建立独立层叠上下文，让 mix-blend-mode 只在本组件内混合 */
  isolation: isolate;
}

.ink-layer {
  position: absolute;
  /* 都比容器大一圈，避免位移动画把边缘露出来 */
  inset: -8%;
  will-change: transform, opacity;
}

/* ---------- ① 底图：极慢推镜 ---------- */
.ink-image {
  inset: -4%;
  background-image: var(--ink-src);
  background-size: cover;
  background-position: center;
  /* 压暗 + 略降饱和，保证白色文字可读，同时不丢掉墨色层次
     亮度由 dim 参数控制：登录页 0.62，首页信息流更暗 */
  filter: brightness(var(--ink-dim, 0.62)) saturate(0.88) contrast(1.06);
  animation: inkDrift 60s ease-in-out infinite alternate;
}

@keyframes inkDrift {
  0%   { transform: scale(1.06) translate3d(0, 0, 0); }
  100% { transform: scale(1.15) translate3d(-1.6%, -1.2%, 0); }
}

/* ---------- ② 雾层 A ---------- */
.ink-fog-a {
  background:
    radial-gradient(ellipse 46% 34% at 26% 58%, rgba(255, 255, 255, 0.13), transparent 68%),
    radial-gradient(ellipse 38% 26% at 72% 44%, rgba(255, 255, 255, 0.10), transparent 70%);
  mix-blend-mode: screen;
  animation: fogA 38s linear infinite;
}

@keyframes fogA {
  0%   { transform: translate3d(-6%, 2%, 0) }
  50%  { transform: translate3d(5%, -2%, 0) }
  100% { transform: translate3d(-6%, 2%, 0) }
}

/* ---------- ③ 雾层 B：更大、更慢、反向 ---------- */
.ink-fog-b {
  background:
    radial-gradient(ellipse 70% 50% at 50% 72%, rgba(214, 228, 235, 0.08), transparent 72%),
    radial-gradient(ellipse 30% 22% at 12% 30%, rgba(255, 255, 255, 0.06), transparent 70%);
  mix-blend-mode: screen;
  opacity: 0.85;
  animation: fogB 52s linear infinite;
}

@keyframes fogB {
  0%   { transform: translate3d(6%, -3%, 0) scale(1) }
  50%  { transform: translate3d(-5%, 3%, 0) scale(1.05) }
  100% { transform: translate3d(6%, -3%, 0) scale(1) }
}

/* ---------- ④ 朱砂光晕：全图唯一的一处暖色，缓慢呼吸 ---------- */
.ink-ember {
  background: radial-gradient(
    circle 26% at 78% 40%,
    rgba(196, 90, 70, 0.22),
    rgba(196, 90, 70, 0.06) 45%,
    transparent 70%
  );
  mix-blend-mode: screen;
  animation: emberBreath 14s ease-in-out infinite;
}

@keyframes emberBreath {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}

/* ---------- ⑤ 暗角：中间留一点亮度给画面，四周收暗托住文字 ---------- */
.ink-vignette {
  background:
    radial-gradient(ellipse 72% 62% at 50% 44%, rgba(0, 0, 0, 0.30) 0%, rgba(0, 0, 0, 0.78) 100%),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.34) 0%, transparent 26%, transparent 68%, #0a0a0b 100%);
}

/* ---------- 尊重系统的减少动态效果偏好 ---------- */
@media (prefers-reduced-motion: reduce) {
  .ink-image,
  .ink-fog-a,
  .ink-fog-b,
  .ink-ember {
    animation: none !important;
  }
}
</style>
