<!-- src/components/AlbumManager.vue —— 相册管理：照片墙的手动整理层
     新建/删除相册、查看相册内照片、从照片墙选图加入、移除照片 -->
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

    <!-- 相册详情弹窗 -->
    <el-dialog v-model="detailVisible" :title="currentAlbum?.title || '相册'" width="760px" class="album-dialog">
      <div v-if="detailLoading" class="album-state">加载中…</div>
      <template v-else>
        <div class="detail-toolbar">
          <span>共 {{ detailPhotos.length }} 张照片</span>
          <button class="album-new-btn" @click="openPicker">+ 从照片墙添加</button>
        </div>
        <div v-if="detailPhotos.length === 0" class="album-state">这个相册还是空的，添加一些照片吧</div>
        <div v-else class="detail-grid">
          <div v-for="p in detailPhotos" :key="p.id" class="detail-photo">
            <img :src="imgUrl(p.url)" :alt="p.caption || '照片'" />
            <span v-if="p.caption" class="detail-caption">{{ p.caption }}</span>
            <button class="detail-remove" title="移出相册" @click="removePhotoFrom(p)">×</button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 选图弹窗：从照片墙勾选 -->
    <el-dialog v-model="pickerVisible" title="从照片墙选图" width="760px" class="album-dialog">
      <div v-if="pickerLoading" class="album-state">加载照片墙…</div>
      <div v-else class="picker-grid">
        <div
          v-for="photo in wallPhotos"
          :key="photo.id"
          class="picker-photo"
          :class="{ selected: selectedIds.has(photo.id) }"
          @click="toggleSelect(photo)"
        >
          <img :src="imgUrl(photo.url)" :alt="photo.caption || '照片'" />
          <span v-if="selectedIds.has(photo.id)" class="picker-check">✓</span>
        </div>
      </div>
      <template #footer>
        <span class="picker-footer-hint">已选 {{ selectedIds.size }} 张</span>
        <el-button @click="pickerVisible = false">取消</el-button>
        <el-button type="primary" :loading="pickerSaving" :disabled="selectedIds.size === 0" @click="confirmAdd">
          加入相册
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getAlbums, createAlbum, updateAlbum, deleteAlbum,
  getAlbumPhotos, addPhotoToAlbum, removePhotoFromAlbum,
} from '../utils/albumApi'
import { getMyPhotos } from '../utils/photoWallApi'

const loading = ref(false)
const albums = ref([])

const detailVisible = ref(false)
const detailLoading = ref(false)
const currentAlbum = ref(null)
const detailPhotos = ref([])

const pickerVisible = ref(false)
const pickerLoading = ref(false)
const pickerSaving = ref(false)
const wallPhotos = ref([])
const selectedIds = reactive(new Set())

function imgUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  // 相对路径即可，由 vite proxy 的 /images 规则转发到后端
  return url.startsWith('/') ? url : '/' + url
}

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
  detailVisible.value = true
  detailLoading.value = true
  try {
    detailPhotos.value = (await getAlbumPhotos(album.id)) || []
  } catch (e) { /* 拦截器已提示 */ }
  finally { detailLoading.value = false }
}

async function removePhotoFrom(photo) {
  try {
    await ElMessageBox.confirm('把这张照片移出相册？', '确认', { type: 'warning' })
    const res = await removePhotoFromAlbum(photo.id)
    if (ok(res, '已移出')) {
      detailPhotos.value = detailPhotos.value.filter((p) => p.id !== photo.id)
      await loadAlbums()
    }
  } catch (e) { /* 用户取消 */ }
}

async function openPicker() {
  selectedIds.clear()
  pickerVisible.value = true
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
      detailPhotos.value = (await getAlbumPhotos(currentAlbum.value.id)) || []
      await loadAlbums()
    }
  } catch (e) { /* 拦截器已提示 */ }
  finally { pickerSaving.value = false }
}

onMounted(loadAlbums)
defineExpose({ refresh: loadAlbums })
</script>

<style scoped>
.album-manager { max-width: 1040px; margin: 0 auto; }
.album-toolbar, .detail-toolbar {
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
.detail-toolbar { font-size: 12px; letter-spacing: 2px; color: var(--txt-3); }
.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  max-height: 55vh;
  overflow-y: auto;
}
.detail-photo { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: 4px; }
.detail-photo img { width: 100%; height: 100%; object-fit: cover; }
.detail-caption {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 4px 6px;
  font-size: 11px;
  color: #fff;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.detail-remove {
  position: absolute; top: 4px; right: 4px;
  width: 22px; height: 22px;
  display: grid; place-items: center;
  font-size: 16px; line-height: 1;
  color: #fff;
  background: rgba(0,0,0,0.6);
  border: none; border-radius: 50%;
  cursor: pointer;
}
.picker-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  max-height: 55vh;
  overflow-y: auto;
}
.picker-photo {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
}
.picker-photo img { width: 100%; height: 100%; object-fit: cover; }
.picker-photo.selected { border-color: var(--c-gold); }
.picker-check {
  position: absolute; top: 4px; right: 4px;
  width: 20px; height: 20px;
  display: grid; place-items: center;
  font-size: 12px; color: #0a0a0a;
  background: var(--c-gold);
  border-radius: 50%;
}
.picker-footer-hint { float: left; font-size: 12px; color: var(--txt-3); line-height: 32px; }
@media (max-width: 900px) {
  .album-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .detail-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .picker-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
