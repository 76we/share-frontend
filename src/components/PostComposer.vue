<!-- src/components/PostComposer.vue —— 首页就地发布
     ============================================================
     目的：把「想写点什么」到「发出去了」之间的成本压到最低。
     原来必须点导航右侧的「写一段」→ 跳转整页 → 填 5 个字段；
     这里在信息流顶部就地展开，只要一个正文框，标题 / 话题 / 地点全部可选到不必填。

     两侧都是同一套语言：伪玻璃卡 + 朱砂按钮 + 6px 控件圆角。
     不引入第二种材质，也不新增字号档位。
     ============================================================ -->
<template>
  <section class="composer" :class="{ open }">
    <!-- 未登录：整条只作为一个入口，不做假输入框 -->
    <button v-if="!logged" class="c-guest" @click="$router.push('/login')">
      <span class="c-avatar c-avatar-txt">尘</span>
      <span class="c-guest-text">登录之后，也可以在这里随手写一句</span>
      <span class="c-guest-go">去登录</span>
    </button>

    <template v-else>
      <div class="c-head">
        <img v-if="me.avatar" class="c-avatar" :src="avatarUrl(me.avatar)" alt="" />
        <span v-else class="c-avatar c-avatar-txt">{{ avatarChar }}</span>

        <textarea
          v-if="open"
          ref="taRef"
          v-model="text"
          class="c-input"
          :placeholder="prompt"
          maxlength="500"
          rows="3"
        />
        <button v-else class="c-hint" @click="expand">
          <span class="c-ph">{{ prompt }}</span>
        </button>

        <button v-if="!open" class="c-shuffle" @click.stop="nextPrompt">换一句</button>
      </div>

      <div v-if="open" class="c-body">
        <!-- 已选图片 -->
        <div v-if="files.length" class="c-thumbs">
          <div v-for="(f, i) in files" :key="f.url" class="c-thumb">
            <img :src="f.url" alt="" />
            <button class="c-thumb-x" type="button" aria-label="移除" @click="removeFile(i)">×</button>
          </div>
        </div>

        <div class="c-foot">
          <div class="c-left">
            <button class="c-act" type="button" @click="pickFiles">＋ 图片</button>
            <span class="c-count" :class="{ full: text.length >= 500 }">{{ text.length }}/500</span>
          </div>
          <div class="c-right">
            <button class="c-cancel" type="button" @click="close">收起</button>
            <button
              class="c-submit"
              type="button"
              :disabled="!canSubmit"
              @click="submit"
            >{{ posting ? '发布中…' : '发一句' }}</button>
          </div>
        </div>

        <p class="c-note">不必写完整，一句也行。想写长的再去<a href="/publish" @click.prevent="toPublish">发布页</a>。</p>
      </div>

      <input
        ref="fileRef"
        class="c-file"
        type="file"
        accept=".jpg,.jpeg,.png"
        multiple
        @change="onFiles"
      />
    </template>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { findPosted } from '../utils/sharePost'
import { compressImages } from '../utils/compressImage'

const emit = defineEmits(['posted'])
const router = useRouter()

const MAX_IMAGES = 4
const MAX_LEN = 500

/* 命题：随机轮换。用户不点也能看到一句「具体的问题」，
   这比「说点什么吧」有效得多 —— 空提示只会让人不知道从哪开始。 */
const PROMPTS = [
  '此刻在想什么？',
  '最近一次改变主意，是因为什么',
  '你住的城市里，最不想被游客发现的地方',
  '今天让你停下来的一件小事',
  '最近反复想起来的一句话',
  '有没有一件还没跟人说过的事',
]

const logged = computed(() => !!localStorage.getItem('token'))
const me = ref({ nickname: '', avatar: null })
const avatarChar = computed(() => (me.value.nickname || localStorage.getItem('nickname') || '尘').charAt(0))

const open = ref(false)
const text = ref('')
const posting = ref(false)
const files = ref([])
const taRef = ref(null)
const fileRef = ref(null)
const promptIdx = ref(0)
const prompt = computed(() => PROMPTS[promptIdx.value])

const canSubmit = computed(() => !!text.value.trim() && !posting.value)

function avatarUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  return url.startsWith('/') ? url : '/' + url
}

async function loadMe() {
  if (!logged.value) return
  try {
    const res = await axios.get('/profile', { silent: true })
    const d = res.data?.data
    if (d) me.value = { nickname: d.nickname || d.username || '', avatar: d.avatar || null }
  } catch (e) {
    // 拿不到头像不影响发帖，用首字兜底
  }
}

function nextPrompt() {
  promptIdx.value = (promptIdx.value + 1) % PROMPTS.length
}

async function expand() {
  open.value = true
  await nextTick()
  taRef.value?.focus()
}

/* 收起不清空：用户可能只是暂时收起来看一眼信息流，
   清掉已写的字是最容易让人放弃的一条路径。发布成功后才重置。 */
function close() {
  open.value = false
  clearFiles()
}

function pickFiles() {
  fileRef.value?.click()
}

function onFiles(e) {
  const picked = Array.from(e.target.files || [])
  for (const f of picked) {
    if (files.value.length >= MAX_IMAGES) {
      ElMessage.warning(`最多 ${MAX_IMAGES} 张图片`)
      break
    }
    // 只认 jpg / png（与后端 FileUtil 一致）。
    // 体积不在这里卡 5MB：提交前会统一压缩到长边 1600 / q0.82，
    // 手机直出 3–4MB 的图压完只剩几百 KB，按原图大小拒绝纯属劝退。
    // 只挡超大的（20MB 以上多半是 RAW 或截图拼接，解码就很慢）。
    if (!/\.(jpe?g|png)$/i.test(f.name)) {
      ElMessage.warning(`「${f.name}」格式不支持，仅 jpg / png`)
      continue
    }
    if (f.size > 20 * 1024 * 1024) {
      ElMessage.warning(`「${f.name}」超过 20MB，请换一张`)
      continue
    }
    files.value.push({ file: f, url: URL.createObjectURL(f) })
  }
  // 清空 input，否则连续选同一张图不会触发 change
  e.target.value = ''
}

function removeFile(i) {
  const [f] = files.value.splice(i, 1)
  if (f?.url) URL.revokeObjectURL(f.url)
}

function clearFiles() {
  files.value.forEach((f) => f.url && URL.revokeObjectURL(f.url))
  files.value = []
}

async function submit() {
  const content = text.value.trim()
  if (!content || posting.value) return
  posting.value = true
  try {
    const fd = new FormData()
    fd.append('dto', new Blob([JSON.stringify({ content })], { type: 'application/json' }))
    // 先压再传：最多 4 张，串行处理约 0.5–1 秒，换来上传体积降到 1/10
    const compressed = await compressImages(files.value.map((f) => f.file))
    compressed.forEach((f) => fd.append('images', f))
    await axios.post('/moments', fd, { timeout: 60000 })

    // 反查新动态的 id 与总篇数（发布接口不返回），拿不到就给 null，不影响后续流程
    const { id, total } = await findPosted(content)
    emit('posted', { id, content, total })
    text.value = ''
    close()
  } catch (e) {
    // 错误提示由 main.js 的响应拦截器统一处理
  } finally {
    posting.value = false
  }
}

function toPublish() {
  router.push('/publish')
}

/* 供父组件调用：发布卡里点「再写一段」时把焦点交回来，
   而不是再跳一次发布页 —— 跳页又会把成本抬回去 */
async function focus() {
  if (!logged.value) {
    router.push('/login')
    return
  }
  await expand()
}
defineExpose({ focus })

onMounted(loadMe)
onBeforeUnmount(clearFiles)
</script>

<style scoped>
/* 材质与首页卡片同源；后面两个 fallback 是为了在别的页面复用时也不至于没样式 */
.composer {
  margin-bottom: 16px;
  background: var(--m-card, rgba(30, 26, 22, 0.74));
  border: 1px solid var(--m-line, rgba(232, 220, 200, 0.08));
  border-radius: 10px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.055),
    0 10px 26px -16px rgba(0, 0, 0, 0.75);
  transition: background 0.25s ease, border-color 0.25s ease;
}
.composer.open {
  background: rgba(34, 29, 24, 0.86);
  border-color: var(--m-line-2, rgba(232, 220, 200, 0.16));
}
.composer:hover:not(.open) {
  background: var(--m-card-hover, rgba(36, 31, 26, 0.86));
}

/* ---------- 未登录 ---------- */
.c-guest {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 15px 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.c-guest-text {
  flex: 1;
  font-size: 13.5px;
  color: var(--m-ink-3, #9a9280);
}
.c-guest-go {
  flex: none;
  font-size: 12.5px;
  color: var(--m-cinnabar, #c0523d);
}

/* ---------- 折叠态 ---------- */
.c-head {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 15px 18px;
}
.composer.open .c-head { padding-bottom: 10px; }

.c-avatar {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.07);
}
.c-avatar-txt {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--m-ink-1, #ede6d8);
  background: rgba(192, 82, 61, 0.2);
}

/* 折叠时是一整条“假输入框”，但语义是按钮：点击才展开 */
.c-hint {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: text;
  text-align: left;
  font-family: inherit;
}
.c-ph {
  display: block;
  overflow: hidden;
  font-size: 13.5px;
  line-height: 32px;
  color: var(--m-ink-3, #9a9280);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.c-shuffle {
  flex: none;
  height: 26px;
  margin-top: 3px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 12px;
  color: var(--m-ink-4, #7e7666);
  background: transparent;
  border: 1px solid var(--m-line, rgba(232, 220, 200, 0.08));
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}
.c-shuffle:hover {
  color: var(--m-ink-2, #c9c1b0);
  border-color: var(--m-line-2, rgba(232, 220, 200, 0.16));
}

/* ---------- 展开态 ---------- */
.c-input {
  flex: 1;
  min-width: 0;
  min-height: 76px;
  padding: 6px 0 0;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.85;
  color: var(--m-ink-1, #ede6d8);
  caret-color: var(--m-cinnabar, #c0523d);
}
.c-input::placeholder { color: var(--m-ink-4, #7e7666); }

.c-body { padding: 0 18px 14px; }

.c-thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 2px 0 12px 43px;
}
.c-thumb {
  position: relative;
  width: 62px;
  height: 62px;
  border-radius: 5px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
}
.c-thumb img { width: 100%; height: 100%; object-fit: cover; }
.c-thumb-x {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 17px;
  height: 17px;
  padding: 0;
  font-size: 12px;
  line-height: 17px;
  color: #f0e9dc;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.c-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 11px;
  border-top: 1px solid var(--m-line, rgba(232, 220, 200, 0.08));
}
.c-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.c-act {
  height: 28px;
  padding: 0 11px;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--m-ink-3, #9a9280);
  background: transparent;
  border: 1px solid var(--m-line, rgba(232, 220, 200, 0.08));
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}
.c-act:hover {
  color: var(--m-ink-1, #ede6d8);
  border-color: var(--m-line-2, rgba(232, 220, 200, 0.16));
}
.c-count {
  font-size: 12px;
  color: var(--m-ink-4, #7e7666);
  font-variant-numeric: tabular-nums;
}
.c-count.full { color: var(--m-cinnabar, #c0523d); }

.c-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
.c-cancel {
  height: 28px;
  padding: 0 11px;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--m-ink-4, #7e7666);
  background: transparent;
  border: none;
  cursor: pointer;
}
.c-cancel:hover { color: var(--m-ink-2, #c9c1b0); }
.c-submit {
  height: 30px;
  padding: 0 20px;
  font-family: inherit;
  font-size: 13px;
  letter-spacing: 0.12em;
  color: #f6efe2;
  background: var(--m-cinnabar, #c0523d);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: filter 0.2s ease, opacity 0.2s ease;
}
.c-submit:hover:not(:disabled) { filter: brightness(1.12); }
.c-submit:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.c-note {
  margin-top: 9px;
  font-size: 11.5px;
  color: var(--m-ink-4, #7e7666);
}
.c-note a {
  color: var(--m-ink-3, #9a9280);
  text-decoration: none;
  border-bottom: 1px solid var(--m-line-2, rgba(232, 220, 200, 0.16));
}
.c-note a:hover { color: var(--m-cinnabar, #c0523d); }

.c-file { display: none; }

@media (max-width: 760px) {
  .c-head { padding: 13px 14px; }
  .c-body { padding: 0 14px 12px; }
  .c-thumbs, .c-note { margin-left: 0; }
  .c-shuffle { display: none; }
  .c-note { display: none; }
}
</style>
