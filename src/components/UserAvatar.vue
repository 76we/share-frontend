<template>
  <span class="u-av">
    <img v-if="show" :src="src" :alt="name || '头像'" loading="lazy" @error="show = false" />
    <span v-else class="u-av__t">{{ initial }}</span>
  </span>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '' },
})

/* 库里大量用户没有头像（avatar = null）。原来直接 <img src=""> 会渲染成一个
   碎图标 + alt 文字，全站每张卡片都挂着一个。这里统一退成首字。
   地址本身失效（404）也走同一条路，所以 error 时也置 false。 */
const show = ref(!!props.src)
watch(
  () => props.src,
  (v) => { show.value = !!v }
)

const initial = computed(() => {
  const n = (props.name || '').trim()
  return n ? n.charAt(0) : '客'
})
</script>

<style scoped>
.u-av {
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  flex: none;
  background: rgba(255, 255, 255, 0.07);
  /* 让下面的 cqw 以自身宽度为基准，首字随头像大小自动缩放 */
  container-type: size;
}
.u-av img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.u-av__t {
  font-family: var(--font-brush, Georgia, serif);
  /* 48cqw ≈ 头像直径的 48%：30px → 14px，46px → 22px */
  font-size: 14px;
  font-size: 48cqw;
  line-height: 1;
  color: var(--c-gold, #c9b38a);
  opacity: 0.86;
  user-select: none;
}
</style>
