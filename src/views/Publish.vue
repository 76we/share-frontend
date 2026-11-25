<!-- src/views/Publish.vue —— 发布图文页（尘叙阁·暗色玄幻风）
     表单：标题、内容、话题下拉（GET /topics）、地点、心情 + 多图上传
     新建：POST /moments（multipart/form-data，dto 为 Blob 包裹的 JSON 字符串 + images 文件），成功后跳 /home
     编辑：/publish?edit=动态id，回填后走 PUT /moments/{id}（只改文字字段，话题与图片保持不变） -->
<template>
  <div class="publish">
    <!-- 顶部标题 -->
    <header class="pub-header">
      <h1 class="pub-title">{{ isEdit ? '修订旧叙' : '执笔写下你的尘间事' }}</h1>
      <div class="divider"></div>
    </header>

    <div class="pub-card nr-card">
      <el-form :model="form" label-position="top" class="pub-form nr-form">
        <!-- 标题（可选） -->
        <el-form-item label="标题（可选）">
          <el-input v-model="form.title" placeholder="为这段故事起个名" maxlength="30" />
        </el-form-item>

        <!-- 内容（必填） -->
        <el-form-item label="内容">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="5"
            placeholder="写下此刻所见所感…"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>

        <!-- 话题下拉（取自 GET /topics，可选）；编辑模式不允许改话题 -->
        <el-form-item label="话题（可选）" v-if="!isEdit">
          <el-select
            v-model="form.topicId"
            placeholder="选择一个话题"
            clearable
            class="pub-select"
            @change="onTopicChange"
          >
            <el-option
              v-for="t in topics"
              :key="t.id"
              :label="t.name"
              :value="t.id"
            />
            <!-- 特殊值 __custom__：选中后展开自定义话题输入框 -->
            <el-option label="其它（自己输入）" :value="CUSTOM_TOPIC" />
          </el-select>
          <!-- 自定义话题输入 -->
          <el-input
            v-if="form.topicId === CUSTOM_TOPIC"
            v-model="form.topicName"
            class="custom-topic-input"
            placeholder="输入你想说的话题，如：露营、咖啡…"
            maxlength="20"
            clearable
          />
        </el-form-item>

        <!-- 地点（可选） -->
        <el-form-item label="地点（可选）">
          <el-input v-model="form.location" placeholder="如 江南·雨巷" />
        </el-form-item>

        <!-- 心情（可选） -->
        <el-form-item label="心情（可选）">
          <el-input v-model="form.mood" placeholder="如 风雪中，闲适" />
        </el-form-item>

        <!-- 多图上传（最多 9 张，可选）；编辑模式不支持替换图片 -->
        <el-form-item label="图片（可选，最多 9 张）" v-if="!isEdit">
          <el-upload
            v-model:file-list="fileList"
            list-type="picture-card"
            :auto-upload="false"
            accept=".jpg,.jpeg,.png"
            multiple
            :limit="9"
          >
            <div class="upload-plus">＋</div>
          </el-upload>
          <p class="upload-tip">最多 9 张，提交时会一并上传</p>
        </el-form-item>

        <!-- 操作按钮 -->
        <div class="pub-actions">
          <el-button class="cancel-btn" @click="router.push('/home')">取 消</el-button>
          <el-button
            class="submit-btn"
            type="primary"
            :loading="loading"
            @click="handleSubmit"
          >{{ submitText }}</el-button>
        </div>
      </el-form>
    </div>

    <!-- 发布成功后的确认卡。关闭（或「再写一段」）后回首页，
         并带上 compose=1 让首页的就地输入框自动展开、拿到焦点。 -->
    <PostedDialog
      v-model:visible="postedVisible"
      :content="postedContent"
      :moment-id="postedId"
      :seq="postedSeq"
      :nickname="nickname"
      @update:visible="onPostedVisible"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import PostedDialog from '../components/PostedDialog.vue'
import { findPosted } from '../utils/sharePost'
import { compressImages } from '../utils/compressImage'

const router = useRouter()
const route = useRoute()

// 编辑模式：/publish?edit=动态id，走 PUT /moments/{id}（只改文字字段，图片与话题不动）
const editId = route.query.edit ? Number(route.query.edit) : null
const isEdit = !!editId

/* ---------------- 表单数据 ---------------- */
// 后端 dto 字段：title 可选，content 必填，topicId / location / mood 可选
// 自定义话题的特殊标记值（避免与数据库 id 冲突）
const CUSTOM_TOPIC = '__custom__'

const form = reactive({
  title: '',
  content: '',
  topicId: null,   // 话题 id（下拉选中）或 CUSTOM_TOPIC，未选则不传
  topicName: '',   // 自定义话题名（topicId === CUSTOM_TOPIC 时有效）
  location: '',
  mood: '',
})

// 切换话题时，若离开"其它"则清空自定义输入
function onTopicChange(val) {
  if (val !== CUSTOM_TOPIC) form.topicName = ''
}

// 话题列表（GET /topics）
const topics = ref([])
// el-upload 的文件列表：每项 raw 属性即原始 File 对象
const fileList = ref([])
const loading = ref(false)

/* 提交分两段：先在浏览器里压缩（9 张大约 1–2 秒），再上传。
   压缩期间按钮必须显示进度，否则用户点完「发布」看不到任何变化，
   会以为没点上而重复点击。 */
const submitPhase = ref('')       // '' | 'compress' | 'upload'
const compressDone = ref(0)
const compressTotal = ref(0)
const submitText = computed(() => {
  if (isEdit) return loading.value ? '保存中…' : '保存修改'
  if (submitPhase.value === 'compress') {
    return compressTotal.value > 1
      ? `整理图片 ${compressDone.value}/${compressTotal.value}`
      : '整理图片…'
  }
  if (submitPhase.value === 'upload') return '上传中…'
  return '发 布'
})

/* 发布成功后的「入阁」确认卡：给归属（第 N 篇）、给产物（存成图）、给地址（复制链接） */
const postedVisible = ref(false)
const postedContent = ref('')
const postedId = ref(null)
const postedSeq = ref(0)
const nickname = ref(localStorage.getItem('nickname') || '')

/* 确认卡关闭后才离开本页：这样用户能先存图 / 复制链接。
   带上 compose=1，首页的就地输入框会展开并聚焦，接着写下一段。 */
function onPostedVisible(v) {
  if (!v) router.push('/home?compose=1')
}

/* ---------------- 草稿：自动存本地，刷新 / 掉线 / 切页都不丢字 ---------------- */
/* 图片保不住：File 对象无法序列化，base64 又会撑爆 localStorage（上限约 5MB）。
   所以只存文字字段，恢复时明确提示"图片需要重新选择"。 */
const DRAFT_KEY = isEdit ? `chenxu-draft-edit-${editId}` : 'chenxu-draft-new'
let draftTimer = null

// 输入变化 800ms 后落一次盘，避免每敲一个字都写 localStorage
function saveDraft() {
  clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    try {
      const empty = !form.title.trim() && !form.content.trim()
      if (empty) {
        localStorage.removeItem(DRAFT_KEY)
        return
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        title: form.title,
        content: form.content,
        topicId: form.topicId,
        topicName: form.topicName,
        location: form.location,
        mood: form.mood,
        savedAt: Date.now(),
      }))
    } catch (e) {
      // 无痕模式 / 超出配额：静默失败，绝不能因为存草稿而影响发布
    }
  }, 800)
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return false
    const d = JSON.parse(raw)
    if (!d || (!String(d.content || '').trim() && !String(d.title || '').trim())) {
      localStorage.removeItem(DRAFT_KEY)
      return false
    }
    form.title = d.title || ''
    form.content = d.content || ''
    form.topicId = d.topicId ?? null
    form.topicName = d.topicName || ''
    form.location = d.location || ''
    form.mood = d.mood || ''
    return true
  } catch (e) {
    return false
  }
}

function clearDraft() {
  clearTimeout(draftTimer)
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch (e) {
    // 忽略
  }
}

watch(form, saveDraft, { deep: true })

/* ---------------- 请求话题列表 ---------------- */
async function fetchTopics() {
  try {
    const res = await axios.get('/topics')
    topics.value = res.data.data ?? []
  } catch (err) {
    // 错误提示由 main.js 的响应拦截器统一弹出
  }
}

/* ---------------- 提交：POST /moments（multipart） ---------------- */
async function handleSubmit() {
  // 内容必填（标题 / 话题 / 地点 / 心情可选，图片可选）
  if (!form.content.trim()) {
    ElMessage.warning('内容不能为空')
    return
  }
  const picked = fileList.value.map((f) => f.raw).filter(Boolean)
  if (picked.length > 9) {
    ElMessage.warning('最多上传 9 张图片')
    return
  }
  // 格式校验放在压缩之前：能否解码决定要不要压，也避免为浏览器解不了的图白等一轮。
  for (const f of picked) {
    const okType = ['image/jpeg', 'image/png'].includes(f.type) || /\.(jpe?g|png)$/i.test(f.name)
    if (!okType) {
      ElMessage.warning(`「${f.name}」格式不支持，仅支持 jpg / png`)
      return
    }
  }

  loading.value = true
  try {
    // 编辑模式：PUT /moments/{id}，只提交文字字段（话题、图片保持原值）
    if (isEdit) {
      const editDto = { content: form.content.trim() }
      if (form.title.trim()) editDto.title = form.title.trim()
      if (form.location.trim()) editDto.location = form.location.trim()
      if (form.mood.trim()) editDto.mood = form.mood.trim()
      await axios.put(`/moments/${editId}`, editDto)
      clearDraft()
      ElMessage.success('修改已保存')
      router.push(`/detail/${editId}`)
      return
    }

    // ① 前端压缩：手机直出 3–4MB/张，9 张 30MB+，4G 上要几十秒。
    //    缩到长边 1600 / q0.82 后单张约 300KB，肉眼无差（见 utils/compressImage.js）。
    //    串行执行，避免 9 张 4000×3000 同时解码把移动端内存打爆。
    let files = picked
    if (picked.length) {
      submitPhase.value = 'compress'
      compressDone.value = 0
      compressTotal.value = picked.length
      files = await compressImages(picked, (done, total) => {
        compressDone.value = done
        compressTotal.value = total
      })
      submitPhase.value = 'upload'
      // 压缩后兜底：正常不会触发（5MB 的图压完只剩几百 KB）
      const tooBig = files.find((f) => f.size > 5 * 1024 * 1024)
      if (tooBig) {
        ElMessage.warning(`「${tooBig.name}」压缩后仍超过 5MB，请换一张`)
        return
      }
    }

    // ② dto：组成 JSON 字符串，用 Blob 包裹后放入 form-data
    const dto = { content: form.content.trim() }
    if (form.title.trim()) dto.title = form.title.trim()
    if (form.topicId === CUSTOM_TOPIC) {
      // 自定义话题：传 topicName，后端按名称查/建话题
      if (!form.topicName.trim()) {
        ElMessage.warning('请填写自定义话题')
        loading.value = false
        return
      }
      dto.topicName = form.topicName.trim()
    } else if (form.topicId !== null && form.topicId !== '') {
      dto.topicId = Number(form.topicId)
    }
    if (form.location.trim()) dto.location = form.location.trim()
    if (form.mood.trim()) dto.mood = form.mood.trim()

    const fd = new FormData()
    fd.append('dto', new Blob([JSON.stringify(dto)], { type: 'application/json' }))

    // ③ images：多图追加为多个同名文件字段（字段名就是 "images"）
    files.forEach((file) => fd.append('images', file))

    // ④ 发请求（请求拦截器自动带 Authorization + token；不要手动设 Content-Type）
    await axios.post('/moments', fd, { timeout: 60000 })

    const content = form.content.trim()
    clearDraft()

    // ⑤ 不直接跳走：先给「入阁」确认卡（可存成图 / 复制链接）。
    //    发布接口不返回 id 与总数，按正文反查一次；拿不到也不影响发帖本身。
    const { id, total } = await findPosted(content)
    postedContent.value = content
    postedId.value = id
    postedSeq.value = total || 0
    postedVisible.value = true
  } catch (err) {
    // 未登录 / 无 token 时后端返回 500，拦截器已弹出错误文案
  } finally {
    loading.value = false
    submitPhase.value = ''
  }
}

onMounted(async () => {
  // 先拉服务器内容（编辑模式），再用本地草稿覆盖：
  // 草稿代表用户比服务器更新的输入，理应优先。
  fetchTopics()
  if (isEdit) await loadForEdit()
  if (restoreDraft()) {
    ElMessage.info('已恢复上次未保存的草稿（图片需要重新选择）')
  }
})

/** 编辑模式：把已有动态回填到表单 */
async function loadForEdit() {
  try {
    const res = await axios.get(`/moments/${editId}`)
    const m = res.data?.data
    if (!m) throw new Error('not found')
    form.title = m.title || ''
    form.content = m.content || ''
    form.location = m.location || ''
    form.mood = m.mood || ''
  } catch (err) {
    ElMessage.error('加载原动态失败，请返回重试')
  }
}
</script>

<style scoped>
/* ---------- 发布页整体 ---------- */
.publish {
  max-width: 680px;
  margin: 0 auto;
  padding: 36px 16px 80px;
}

.pub-header {
  text-align: center;
  margin-bottom: 28px;
}
.pub-title {
  font-family: var(--font-brush);
  font-size: 38px;
  font-weight: 400;
  letter-spacing: 6px;
  color: #f5f5f5;
}
.pub-header .divider {
  margin: 16px auto 0;
}

/* 表单卡片：半透明玻璃，让背后的水墨壁纸透出来。
   与首页不同 —— 这里全程只有一张卡片，backdrop-filter 的逐帧成本可以接受，
   所以用真模糊而不是伪玻璃；模糊半径只取 12px —— 再大就把山形也糊平了，「能看到背景」这件事就没了。 */
.pub-card {
  padding: 36px 36px 30px;
  background:
    linear-gradient(155deg, rgba(255, 245, 232, 0.06), rgba(255, 245, 232, 0) 48%),
    rgba(16, 17, 20, 0.20);
  border-color: rgba(232, 226, 216, 0.14);
  backdrop-filter: blur(12px) saturate(1.1);
  -webkit-backdrop-filter: blur(12px) saturate(1.1);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.08) inset,
    0 28px 70px -32px rgba(0, 0, 0, 0.92);
}
/* hover 沿用同一套值：父级 .nr-card:hover 会把描边加亮并重绘阴影，
   这里要盖住，否则鼠标移入卡片时玻璃层的阴影会跳一下 */
.pub-card:hover {
  border-color: rgba(232, 226, 216, 0.2);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.08) inset,
    0 28px 70px -32px rgba(0, 0, 0, 0.92);
}

/* 控件压在半透明卡片上：全局的 --fill 只有 5% 白，叠在玻璃上会完全看不出来。
   改用比卡片更暗的半透明，让输入框「凹」进去，边界靠内描边撑住。 */
.pub-form :deep(.el-input__wrapper),
.pub-form :deep(.el-textarea__inner) {
  background: rgba(8, 9, 12, 0.34);
}
.pub-form :deep(.el-input__wrapper:hover),
.pub-form :deep(.el-textarea__inner:hover) {
  background: rgba(8, 9, 12, 0.42);
}

/* label 与输入框
   卡片变半透明后，背景的明暗会透到字下面，--txt-2 / --txt-3 的对比度不够了，
   这一页单独把标签和占位符提一档，保证压在水墨上仍然清楚。 */
.pub-form :deep(.el-form-item__label) {
  font-family: var(--font-body);
  font-size: 13px;
  letter-spacing: 3px;
  color: rgba(240, 237, 231, 0.84);
}
.pub-form :deep(.el-input__inner::placeholder),
.pub-form :deep(.el-textarea__inner::placeholder) {
  color: rgba(214, 209, 200, 0.6);
}

/* 下拉框暗色：穿透 el-select */
.pub-select :deep(.el-select__wrapper) {
  background: rgba(8, 9, 12, 0.34);
  box-shadow: 0 0 0 1px var(--card-border) inset;
  border-radius: 2px;
  min-height: 36px;
}
.pub-select :deep(.el-select__placeholder) {
  color: rgba(214, 209, 200, 0.6);
}
.pub-select :deep(.el-select__selected-item) {
  color: var(--txt-1);
}
/* 自定义话题输入框 */
.custom-topic-input {
  margin-top: 10px;
}
.custom-topic-input :deep(.el-input__wrapper) {
  background: rgba(8, 9, 12, 0.34);
  box-shadow: 0 0 0 1px var(--card-border) inset;
  border-radius: 2px;
}
.custom-topic-input :deep(.el-input__inner) {
  color: var(--txt-1);
}
.custom-topic-input :deep(.el-input__inner::placeholder) {
  color: var(--txt-3);
}
/* 下拉弹层（挂在 body 下，用全局兜底 + 组件内补强） */
.pub-select :deep(.el-select-dropdown),
.pub-select :deep(.el-popper) {
  background: #1a1a1a;
  border: 1px solid var(--card-border);
}

/* 上传卡片 */
.upload-plus {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--txt-3);
}
:deep(.el-upload--picture-card) {
  width: 110px;
  height: 110px;
  background: rgba(8, 9, 12, 0.28);
  box-shadow: 0 0 0 1px var(--card-border) inset;
  border-radius: 2px;
  overflow: hidden;
}
:deep(.el-upload-list--picture-card),
:deep(.el-upload-list--picture-card .el-upload-list__item) {
  width: 110px;
  height: 110px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--card-border);
  overflow: hidden;
}
/* el-form-item 的内容区是 flex 容器：上传框和提示会并排，
   窄屏下提示被挤到卡片外面。强制另起一行。 */
.upload-tip {
  flex: 0 0 100%;
  margin-top: 8px;
  font-size: 12px;
  letter-spacing: 1px;
  color: rgba(204, 199, 190, 0.62);
}

/* 底部按钮 */
.pub-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  margin-top: 8px;
}
.cancel-btn {
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--txt-2);
  letter-spacing: 4px;
}
.cancel-btn:hover,
.cancel-btn:focus {
  border-color: var(--card-border-hover);
  color: var(--txt-1);
  background: transparent;
}
.submit-btn {
  background: rgba(255, 255, 255, 0.92);
  border: none;
  color: #0a0a0a;
  letter-spacing: 4px;
}
.submit-btn:hover,
.submit-btn:focus {
  background: #ffffff;
  color: #0a0a0a;
}
.submit-btn:disabled {
  opacity: 0.5;
  background: rgba(255, 255, 255, 0.92);
  color: #0a0a0a;
}

/* ---------- 窄屏 ----------
   这个页原本没有任何移动端规则：38px 标题配 6px 字距，390px 下会折成
   「执笔写下你的尘间 / 事」，最后一行只剩一个字。 */
@media (max-width: 600px) {
  .publish {
    padding: 26px 12px 64px;
  }
  .pub-header {
    margin-bottom: 20px;
  }
  .pub-title {
    font-size: 26px;
    letter-spacing: 4px;
  }
  .pub-card {
    padding: 24px 18px 22px;
  }
}
</style>
