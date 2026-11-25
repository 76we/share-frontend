<!-- src/components/PavilionMark.vue —— 品牌阁楼剪影（替代原来的方框「尘」字印章）
     结构：宝顶 → 上檐 → 上墙 → 下檐 → 下墙 → 台基，六段堆叠出"重檐楼阁"的轮廓。
     纯矢量、单色走 currentColor：尺寸由 font-size 控制（1em），颜色继承父级，缩放不糊。 -->
<template>
  <svg class="pavilion-mark" viewBox="0 0 48 44" fill="currentColor" aria-hidden="true" focusable="false">
    <!-- 宝顶（短尖 + 短柱，压低重心，避免读成"塔"） -->
    <path d="M24 6.2 25.8 9.5H22.2L24 6.2Z" />
    <rect x="23" y="9.3" width="2" height="3.2" rx="0.4" />
    <!-- 上檐：加宽，与下檐形成"重檐"层次 -->
    <path d="M24 12.4Q32.6 12.4 41.2 16.5Q32.1 18.2 24 18.2Q15.9 18.2 6.8 16.5Q15.4 12.4 24 12.4Z" />
    <!-- 上层腰檐横梁 -->
    <rect x="18.3" y="18" width="11.4" height="2.6" rx="0.4" />
    <!-- 下檐：更宽，翘角外挑 -->
    <path d="M24 21.5Q37.6 21.5 45.6 27.4Q37.4 29.3 24 29.3Q10.6 29.3 2.4 27.4Q10.4 21.5 24 21.5Z" />
    <!-- 下墙身：带门洞（evenodd 挖空） -->
    <path fill-rule="evenodd" d="M12.6 29.2h22.8v9.6H12.6V29.2Zm7.4 3.9h7v5.7h-7v-5.7Z" />
    <!-- 台基 -->
    <rect x="9.8" y="37.6" width="28.4" height="2.8" rx="0.9" />
  </svg>
</template>

<style scoped>
.pavilion-mark {
  display: block;
  width: 1em;
  height: 1em;
  color: inherit;
}
</style>
