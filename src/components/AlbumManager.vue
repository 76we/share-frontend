<!-- src/components/AlbumManager.vue —— 相册管理：照片墙的手动整理层
     新建/删除相册、翻看相册、从照片墙选图加入、移除照片 -->
<template>
  <div class="album-manager">
    <div class="album-toolbar">
      <span class="album-hint">把喜欢的照片收进相册，按主题慢慢整理</span>
      <button class="album-new-btn" @click="openCreate">+ 新建相册</button>
    </div>

    <div v-if="loading" class="album-state">正在翻开相册…</div>
    <div v-else-if="albums.length === 0" class="album-state">
      <p>还没有相册，建一个吧</p>
      <button class="album-new-btn" @click="openCreate">+ 新建相册</button>
    </div>

    <div v-else class="album-grid">
      <div v-for="album in albums" :key="album.id" class="album-card">
        <div class="album-cover" @click="openAlbum(album)">
          <template v-if="album.covers && album.covers.length">
            <img
              v-for="(url, i) in album.covers"
              :key="i"
              :src="imgUrl(url)"
              alt=""
              class="album-cover-img"
              :style="{ '--i': i }"
            />
          </template>
          <div v-else class="album-cover-empty">空</div>
          <span class="album-count">{{ album.photoCount || 0 }} 张</span>
        </div>
        <div class="album-meta">
          <span class="album-title" @click="openAlbum(album)">{{ album.title }}</span>
          <span class="album-actions">
            <button title="重命名" @click="openRename(album)">改</button>
            <button title="删除相册" @click="removeAlbum(album)">删</button>
          </span>
        </div>
        <p v-if="album.description" class="album-desc">{{ album.description }}</p>
      </div>
    </div>

    <!-- ============ 相册翻阅器 ============
         原先是一个 760×297 的默认弹窗，浮在页面中间，和整站的墨色纸张毫无关系。
         相册本来就是「一叠照片」，所以给一张整幅的台面：上方标题，中间大图，
         下方一条胶片式的缩略带，翻哪张一目了然。 -->
    <Teleport to="body">
      <transition name="av-fade">
        <div v-if="detailVisible" class="av-root">
          <div class="av-backdrop" @click="closeDetail"></div>

          <section class="av-shell">
            <header class="av-bar">
              <div class="av-bar-l">
                <span class="av-kicker">相 册</span>
                <h2 class="av-title">{{ currentAlbum?.title || '相册' }}</h2>
                <p class="av-sub">
                  <span>{{ detailLoading ? '…' : detailPhotos.length }} 张</span>
                  <template v-if="currentAlbum?.description"> · {{ currentAlbum.description }}</template>
                </p>
              </div>
              <div class="av-bar-r">
                <button class="av-btn" @click="openPicker">＋ 添加照片</button>
                <button class="av-close" @click="closeDetail" aria-label="关闭">×</button>
              </div>
            </header>

            <div v-if="detailLoading" class="av-state">正在摊开照片…</div>
            <div v-else-if="detailPhotos.length === 0" class="av-state">
              <p>这个相册还是空的</p>
              <button class="av-btn" @click="openPicker">从照片墙挑几张</button>
            </div>

            <template v-else>
              <div class="av-stage" @touchstart.passive="onSwipeStart" @touchend="onSwipeEnd">
                <button
                  v-if="detailPhotos.length > 1"
                  class="av-nav av-prev"
                  @click="stepPhoto(-1)"
                  aria-label="上一张"
                >‹</button>
                <img
                  :key="currentPhoto.id"
                  class="av-photo"
                  :src="imgUrl(currentPhoto.url)"
                  :alt="currentPhoto.caption || '照片'"
                />
                <button
                  v-if="detailPhotos.length > 1"
                  class="av-nav av-next"
                  @click="stepPhoto(1)"
                  aria-label="下一张"
                >›</button>
              </div>

              <div class="av-caption">
                <span class="av-caption-text">{{ currentPhoto.caption || '无题' }}</span>
                <span class="av-caption-right">
                  <button class="av-remove" @click="removePhotoFrom(currentPhoto)">移出相册</button>
                  <span class="av-idx">{{ stageIndex + 1 }} / {{ detailPhotos.length }}</span>
                </span>
              </div>

              <!-- 胶片带：整本相册一眼看完，点哪张到哪张 -->
              <div class="av-strip">
                <button
                  v-for="(p, i) in detailPhotos"
                  :key="p.id"
                  class="av-thumb"
                  :class="{ active: i === stageIndex }"
                  @click="stageIndex = i"
                >
                  <img :src="imgUrl(p.url)" alt="" loading="lazy" />
                </button>
              </div>
            </template>
          </section>
        </div>
      </transition>
    </Teleport>

    <!-- ============ 从照片墙选图 ============ -->
    <Teleport to="body">
      <transition name="av-fade">
        <div v-if="pickerVisible" class="av-root av-root-picker">
          <div class="av-backdrop" @click="pickerVisible = false"></div>
          <section class="pk-shell">
            <header class="av-bar">
              <div class="av-bar-l">
                <span class="av-kicker">选 图</span>
                <h2 class="av-title">从照片墙挑几张</h2>
                <p class="av-sub">已选 {{ selectedIds.size }} 张</p>
              </div>
              <div class="av-bar-r">
                <button class="av-close" @click="pickerVisible = false" aria-label="关闭">×</button>
              </div>
            </header>

            <div v-if="pickerLoading" class="av-state">正在铺开照片墙…</div>
            <div v-else-if="wallPhotos.length === 0" class="av-state">照片墙还空着，先去发一条带图的动态</div>
            <div v-else class="pk-grid">
              <button
                v-for="photo in wallPhotos"
                :key="photo.id"
                class="pk-photo"
                :class="{ selected: selectedIds.has(photo.id) }"
                @click="toggleSelect(photo)"
              >
                <img :src="imgUrl(photo.url)" :alt="photo.caption || '照片'" loading="lazy" />
                <span v-if="selectedIds.has(photo.id)" class="pk-check">✓</span>
              </button>
            </div>

            <footer class="pk-foot">
              <span class="pk-hint">再点一次取消选择</span>
              <span class="pk-actions">
                <button class="av-btn av-btn-quiet" @click="pickerVisible = false">取消</button>
                <button
                  class="av-btn av-btn-solid"
                  :disabled="selectedIds.size === 0 || pickerSaving"
                  @click="confirmAdd"
                >{{ pickerSaving ? '正在加入…' : `加入相册${selectedIds.size ? `（${selectedIds.size}）` : ''}` }}</button>
              </span>
            </footer>
          </section>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  getAlbums, createAlbum, updateAlbum, deleteAlbum,
  getAlbumPhotos, addPhotoToAlbum, removePhotoFromAlbum,
} from '../utils/albumApi'
import { getMyPhotos } from '../utils/photoWallApi'
import { imgUrl } from '../utils/url'

const loading = ref(false)
const albums = ref([])

const detailVisible = ref(false)
const detailLoading = ref(false)
const currentAlbum = ref(null)
const detailPhotos = ref([])
const stageIndex = ref(0)

const pickerVisible = ref(false)
const pickerLoading = ref(false)
const pickerSaving = ref(false)
const wallPhotos = ref([])
const selectedIds = reactive(new Set())

const currentPhoto = computed(() => detailPhotos.value[stageIndex.value] || null)

async function loadAlbums() {
  loading.value = true
  try {
    albums.value = (await getAlbums()) || []
  } catch (e) { /* 拦截器已提示 */ }
  finally { loading.value = false }
}

function ok(res, msg) {
  if (res?.code === 200) { ElMessage.success(msg); return true }
  return false
}

async function openCreate() {
  try {
    const { value } = await ElMessageBox.prompt('给相册起个名字', '新建相册', {
      confirmButtonText: '创建', cancelButtonText: '取消', inputPlaceholder: '如：山河行记',
    })
    if (!value || !value.trim()) return
    const res = await createAlbum(value.trim(), null)
    if (ok(res, '相册已创建')) await loadAlbums()
  } catch (e) { /* 用户取消 */ }
}

async function openRename(album) {
  try {
    const { value } = await ElMessageBox.prompt('修改相册名称', '重命名', {
      confirmButtonText: '保存', cancelButtonText: '取消', inputValue: album.title,
    })
    if (!value || !value.trim()) return
    const res = await updateAlbum(album.id, value.trim(), album.description)
    if (ok(res, '已保存')) await loadAlbums()
  } catch (e) { /* 用户取消 */ }
}

async function removeAlbum(album) {
  try {
    await ElMessageBox.confirm(`删除「${album.title}」及其中所有照片？`, '确认删除', { type: 'warning' })
    const res = await deleteAlbum(album.id)
    if (ok(res, '已删除')) await loadAlbums()
  } catch (e) { /* 用户取消 */ }
}

async function openAlbum(album) {
  currentAlbum.value = album
  detailPhotos.value = []
  stageIndex.value = 0
  detailVisible.value = true
  lockScroll(true)
  detailLoading.value = true
  try {
    detailPhotos.value = (await getAlbumPhotos(album.id)) || []
  } catch (e) { /* 拦截器已提示 */ }
  finally { detailLoading.value = false }
}

function closeDetail() {
  detailVisible.value = false
  lockScroll(false)
}

function stepPhoto(d) {
  const n = detailPhotos.value.length
  if (n < 2) return
  stageIndex.value = (stageIndex.value + d + n) % n
}

/* 手机上左右滑动翻照片（箭头浮在照片上，但拇指还是滑更顺） */
let swipeFrom = null
function onSwipeStart(e) {
  const t = e.changedTouches?.[0]
  if (!t) return
  swipeFrom = { x: t.clientX, y: t.clientY, at: Date.now() }
}
function onSwipeEnd(e) {
  const s = swipeFrom
  swipeFrom = null
  const t = e.changedTouches?.[0]
  if (!s || !t) return
  const dx = t.clientX - s.x
  const dy = t.clientY - s.y
  if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.4) return
  if (Date.now() - s.at > 800) return
  stepPhoto(dx < 0 ? 1 : -1)
}

async function removePhotoFrom(photo) {
  try {
    await ElMessageBox.confirm('把这张照片移出相册？', '确认', {
      type: 'warning',
      confirmButtonText: '移出',
      cancelButtonText: '留着',
    })
    const res = await removePhotoFromAlbum(photo.id)
    if (ok(res, '已移出')) {
      const i = stageIndex.value
      detailPhotos.value = detailPhotos.value.filter((p) => p.id !== photo.id)
      // 移走的正好是当前这张：停在原位（顺延到下一张），别跳回第一张
      stageIndex.value = Math.max(0, Math.min(i, detailPhotos.value.length - 1))
      await loadAlbums()
    }
  } catch (e) { /* 用户取消 */ }
}

async function openPicker() {
  selectedIds.clear()
  pickerVisible.value = true
  lockScroll(true)
  pickerLoading.value = true
  try {
    const data = await getMyPhotos(1, 100)
    wallPhotos.value = data?.records || []
  } catch (e) { /* 拦截器已提示 */ }
  finally { pickerLoading.value = false }
}

function toggleSelect(photo) {
  if (selectedIds.has(photo.id)) selectedIds.delete(photo.id)
  else selectedIds.add(photo.id)
}

async function confirmAdd() {
  pickerSaving.value = true
  let added = 0
  try {
    for (const photo of wallPhotos.value) {
      if (!selectedIds.has(photo.id)) continue
      const res = await addPhotoToAlbum(currentAlbum.value.id, photo.url, photo.caption)
      if (res?.code === 200) added++
    }
    if (added > 0) {
      ElMessage.success(`已加入 ${added} 张`)
      pickerVisible.value = false
      lockScroll(detailVisible.value)
      const list = (await getAlbumPhotos(currentAlbum.value.id)) || []
      detailPhotos.value = list
      // 新加的几张在末尾，直接把镜头推到第一张新照片
      stageIndex.value = Math.max(0, list.length - added)
      await loadAlbums()
    }
  } catch (e) { /* 拦截器已提示 */ }
  finally { pickerSaving.value = false }
}

/* 两个浮层都可能锁 body 滚动，谁还开着就保持锁定 */
function lockScroll(on) {
  if (!on && (detailVisible.value || pickerVisible.value)) return
  document.body.style.overflow = on ? 'hidden' : ''
}

function onKeydown(e) {
  if (pickerVisible.value) {
    if (e.key === 'Escape') { pickerVisible.value = false; lockScroll(detailVisible.value) }
    return
  }
  if (!detailVisible.value) return
  if (e.key === 'Escape') closeDetail()
  else if (e.key === 'ArrowLeft') stepPhoto(-1)
  else if (e.key === 'ArrowRight') stepPhoto(1)
}

watch(() => detailPhotos.value.length, (n) => {
  if (n && stageIndex.value > n - 1) stageIndex.value = n - 1
})

onMounted(() => {
  loadAlbums()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
defineExpose({ refresh: loadAlbums })
</script>

<style scoped>
.album-manager { max-width: 1040px; margin: 0 auto; }
.album-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.album-hint { font-size: 12px; letter-spacing: 2px; color: var(--txt-3); }
.album-new-btn {
  font-family: var(--font-body);
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--c-gold);
  background: rgba(222, 217, 203, 0.06);
  border: 1px solid var(--c-gold-dim);
  border-radius: 999px;
  padding: 7px 18px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.album-new-btn:hover { background: rgba(222, 217, 203, 0.12); border-color: var(--c-gold); }
.album-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 20px;
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--c-gold-dim);
}
.album-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px 24px;
}
.album-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 14px;
  transition: border-color 0.25s ease, transform 0.25s ease;
}
.album-card:hover { border-color: var(--c-gold-dim); transform: translateY(-3px); }
.album-cover {
  position: relative;
  height: 170px;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.album-cover-img {
  position: absolute;
  width: 62%;
  height: 82%;
  object-fit: cover;
  border: 4px solid #e9e6de;
  border-radius: 2px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
  transform: rotate(calc((var(--i) - 1) * 7deg)) translateX(calc((var(--i) - 1) * 8px));
}
.album-cover-empty {
  width: 62%; height: 82%;
  display: grid; place-items: center;
  border: 1px dashed var(--c-gold-faint);
  border-radius: 4px;
  color: var(--c-gold-faint);
  font-family: var(--font-brush);
  font-size: 24px;
}
.album-count {
  position: absolute;
  right: 8px; bottom: 6px;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--c-gold);
  background: rgba(10, 10, 12, 0.7);
  padding: 2px 8px;
  border-radius: 999px;
}
.album-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
}
.album-title {
  font-family: var(--font-brush);
  font-size: 17px;
  letter-spacing: 2px;
  color: var(--c-gold);
  cursor: pointer;
}
.album-actions { display: flex; gap: 6px; }
.album-actions button {
  font-size: 11px;
  color: var(--txt-3);
  background: transparent;
  border: 1px solid var(--card-border);
  border-radius: 3px;
  padding: 2px 7px;
  cursor: pointer;
}
.album-actions button:hover { color: var(--c-gold); border-color: var(--c-gold-dim); }
.album-desc {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--txt-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- 翻阅器 ---------- */
.av-root {
  position: fixed;
  inset: 0;
  z-index: 1800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.av-root-picker { z-index: 1850; }
.av-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(6, 7, 10, 0.82);
  backdrop-filter: blur(10px);
}
.av-shell {
  position: relative;
  z-index: 2;
  width: min(1120px, 94vw);
  height: min(86vh, 840px);
  display: flex;
  flex-direction: column;
  background: rgba(16, 17, 21, 0.94);
  border: 1px solid rgba(222, 217, 203, 0.14);
  border-radius: 10px;
  box-shadow: 0 40px 100px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}
.av-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(222, 217, 203, 0.1);
  flex: none;
}
.av-kicker {
  display: block;
  font-size: 10px;
  letter-spacing: 5px;
  color: var(--c-gold);
  opacity: 0.8;
  margin-bottom: 5px;
}
.av-title {
  margin: 0;
  font-family: var(--font-brush);
  font-size: 24px;
  font-weight: 400;
  letter-spacing: 3px;
  line-height: 1.3;
  color: rgba(245, 242, 236, 0.96);
}
.av-sub {
  margin: 6px 0 0;
  font-size: 12px;
  letter-spacing: 1.5px;
  color: rgba(222, 217, 203, 0.46);
}
.av-bar-r { display: flex; align-items: center; gap: 10px; flex: none; }
.av-btn {
  font-family: var(--font-body);
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--c-gold);
  background: rgba(222, 217, 203, 0.06);
  border: 1px solid rgba(222, 217, 203, 0.22);
  border-radius: 999px;
  padding: 8px 18px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}
.av-btn:hover { background: rgba(222, 217, 203, 0.13); border-color: var(--c-gold); }
.av-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.av-btn-quiet { color: rgba(240, 237, 231, 0.7); }
.av-btn-solid {
  color: #14120e;
  background: var(--c-gold);
  border-color: var(--c-gold);
  font-weight: 500;
}
.av-btn-solid:hover { background: #f0e4c4; border-color: #f0e4c4; }
.av-close {
  width: 34px; height: 34px;
  display: grid; place-items: center;
  font-size: 20px; line-height: 1;
  color: rgba(240, 237, 231, 0.7);
  background: transparent;
  border: 1px solid rgba(222, 217, 203, 0.18);
  border-radius: 50%;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}
.av-close:hover { color: var(--c-gold); border-color: var(--c-gold); }
.av-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--c-gold-dim);
}
.av-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 22px 72px;
  /* 舞台比面板亮一档，而不是暗一档：黑底的照片贴在黑背景上会「化掉」，
     浅一点的台面才能把照片的边界托出来（美术馆从不在黑墙上挂黑画） */
  background: rgba(255, 255, 255, 0.045);
}
.av-photo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 3px;
  /* 用一圈极淡的亮边代替边框：黑照片贴在黑底上时，只有这条边能说明它到哪儿为止 */
  box-shadow:
    0 0 0 1px rgba(238, 234, 226, 0.14),
    0 20px 54px rgba(0, 0, 0, 0.66);
  animation: av-photo-in 0.3s ease;
}
@keyframes av-photo-in {
  from { opacity: 0; transform: scale(0.99); }
  to { opacity: 1; transform: scale(1); }
}
.av-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 38px; height: 38px;
  display: grid; place-items: center;
  font-size: 24px; line-height: 1;
  color: var(--c-gold);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(222, 217, 203, 0.22);
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.av-nav:hover { background: rgba(222, 217, 203, 0.14); border-color: var(--c-gold); }
.av-prev { left: 16px; }
.av-next { right: 16px; }
.av-caption {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 26px 10px;
  font-size: 12px;
  letter-spacing: 1.5px;
  color: rgba(222, 217, 203, 0.55);
}
.av-caption-text {
  font-family: Georgia, 'Songti SC', serif;
  font-style: italic;
  font-size: 13px;
  color: rgba(240, 237, 231, 0.8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.av-caption-right { display: flex; align-items: center; gap: 16px; flex: none; }
.av-remove {
  font-size: 11px;
  letter-spacing: 1.5px;
  color: rgba(222, 217, 203, 0.4);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;
}
.av-remove:hover { color: #d98a9a; }
.av-idx { font-variant-numeric: tabular-nums; color: rgba(222, 217, 203, 0.4); }

/* 胶片带 */
.av-strip {
  flex: none;
  display: flex;
  gap: 8px;
  padding: 12px 20px 16px;
  overflow-x: auto;
  border-top: 1px solid rgba(222, 217, 203, 0.1);
  background: rgba(0, 0, 0, 0.22);
  scrollbar-width: thin;
}
.av-thumb {
  flex: none;
  width: 62px;
  height: 62px;
  padding: 0;
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid rgba(222, 217, 203, 0.14);
  background: transparent;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}
.av-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.av-thumb:hover { opacity: 0.9; }
.av-thumb.active {
  opacity: 1;
  border-color: var(--c-gold);
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.5);
}

/* ---------- 选图 ---------- */
.pk-shell {
  position: relative;
  z-index: 2;
  width: min(1000px, 94vw);
  /* 照片少时让面板贴着内容收短，别留一大片空底 */
  height: auto;
  max-height: min(82vh, 720px);
  display: flex;
  flex-direction: column;
  background: rgba(16, 17, 21, 0.95);
  border: 1px solid rgba(222, 217, 203, 0.14);
  border-radius: 10px;
  box-shadow: 0 40px 100px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}
.pk-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  padding: 16px 20px;
  align-content: start;
}
.pk-photo {
  position: relative;
  display: block;
  aspect-ratio: 1;
  /* 网格默认会纵向拉伸，aspect-ratio 就被撑掉了，缩略图会变成横的 */
  align-self: start;
  padding: 0;
  overflow: hidden;
  border-radius: 4px;
  border: 2px solid transparent;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: border-color 0.18s ease, transform 0.18s ease;
}
.pk-photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0.86;
  transition: opacity 0.18s ease;
}
.pk-photo:hover img { opacity: 1; }
.pk-photo:hover { transform: translateY(-2px); }
.pk-photo.selected { border-color: var(--c-gold); }
.pk-photo.selected img { opacity: 1; }
.pk-check {
  position: absolute;
  top: 5px; right: 5px;
  width: 20px; height: 20px;
  display: grid; place-items: center;
  font-size: 12px;
  color: #14120e;
  background: var(--c-gold);
  border-radius: 50%;
}
.pk-foot {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 22px;
  border-top: 1px solid rgba(222, 217, 203, 0.1);
  background: rgba(0, 0, 0, 0.2);
}
.pk-hint { font-size: 11.5px; letter-spacing: 1.5px; color: rgba(222, 217, 203, 0.36); }
.pk-actions { display: flex; gap: 10px; }

/* 进出场：整块浮起，不做位移 */
.av-fade-enter-active, .av-fade-leave-active { transition: opacity 0.22s ease; }
.av-fade-enter-from, .av-fade-leave-to { opacity: 0; }
.av-fade-enter-active .av-shell, .av-fade-enter-active .pk-shell { transition: transform 0.26s cubic-bezier(0.22, 0.8, 0.3, 1); }
.av-fade-enter-from .av-shell, .av-fade-enter-from .pk-shell { transform: scale(0.975); }

@media (max-width: 900px) {
  .album-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .av-root { padding: 0; }
  .av-shell, .pk-shell {
    width: 100vw;
    height: 100dvh;
    border-radius: 0;
    border: none;
  }
  .av-stage { padding: 10px 8px; }
  .av-nav {
    width: 34px; height: 34px;
    font-size: 20px;
    /* 手机上不预留槽位（预留会把照片挤到 310px 宽），箭头浮在照片上，
       所以给它一层暗底，压在浅色照片上也看得清 */
    background: rgba(10, 11, 14, 0.62);
    backdrop-filter: blur(4px);
  }
  .av-prev { left: 14px; }
  .av-next { right: 14px; }
  .av-caption { padding: 0 16px 8px; }
  .av-strip { padding: 10px 12px 14px; }
  .av-thumb { width: 54px; height: 54px; }
  .pk-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .av-bar { padding: 16px 16px 12px; }
  .av-title { font-size: 20px; }
}
</style>
