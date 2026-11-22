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
            maxlength="500"
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
          >{{ isEdit ? '保存修改' : '发 布' }}</el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

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
  const files = fileList.value.map((f) => f.raw).filter(Boolean)
  if (files.length > 9) {
    ElMessage.warning('最多上传 9 张图片')
    return
  }
  // 与后端 FileUtil.upload 的限制保持一致：仅 jpg/jpeg/png，单张 ≤5MB
  for (const f of files) {
    const okType = ['image/jpeg', 'image/png'].includes(f.type) || /\.(jpe?g|png)$/i.test(f.name)
    if (!okType) {
      ElMessage.warning(`「${f.name}」格式不支持，仅支持 jpg / png`)
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      ElMessage.warning(`「${f.name}」超过 5MB，请压缩后再传`)
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
      ElMessage.success('修改已保存')
      router.push(`/detail/${editId}`)
      return
    }

    // ① dto：组成 JSON 字符串，用 Blob 包裹后放入 form-data
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

    // ② images：多图追加为多个同名文件字段（字段名就是 "images"）
    files.forEach((file) => fd.append('images', file))

    // ③ 发请求（请求拦截器自动带 Authorization + token；不要手动设 Content-Type）
    await axios.post('/moments', fd)

    ElMessage.success('发布成功，心事已入尘叙阁')
    // ④ 回首页，组件重新挂载会重新拉列表
    router.push('/home')
  } catch (err) {
    // 未登录 / 无 token 时后端返回 500，拦截器已弹出错误文案
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  fetchTopics()
  if (isEdit) await loadForEdit()
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

/* 表单卡片 */
.pub-card {
  padding: 36px 36px 30px;
}

/* label 与输入框 */
.pub-form :deep(.el-form-item__label) {
  font-family: var(--font-body);
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--txt-2);
}

/* 下拉框暗色：穿透 el-select */
.pub-select :deep(.el-select__wrapper) {
  background: var(--fill);
  box-shadow: 0 0 0 1px var(--card-border) inset;
  border-radius: 2px;
  min-height: 36px;
}
.pub-select :deep(.el-select__placeholder) {
  color: var(--txt-2);
}
.pub-select :deep(.el-select__selected-item) {
  color: var(--txt-1);
}
/* 自定义话题输入框 */
.custom-topic-input {
  margin-top: 10px;
}
.custom-topic-input :deep(.el-input__wrapper) {
  background: var(--fill);
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
  background: var(--fill);
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
.upload-tip {
  margin-top: 8px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--txt-3);
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
</style>
