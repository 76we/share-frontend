<!-- src/views/Profile.vue —— 个人中心（尘叙阁·暗色玄幻风）
     展示头像/昵称/简介 + 发布/获赞/收藏统计；
     三个标签页：我的发布 / 我点赞 / 我收藏（复用动态卡片）；
     支持编辑资料、修改密码。对接 ProfileController（/profile）。 -->
<template>
  <div class="profile-wrap">
    <div class="profile-inner">
      <!-- ============ 个人名片 ============ -->
      <header class="profile-hero nr-card nr-glow">
        <div class="hero-deco" aria-hidden="true"><span class="ornament-diamond"></span></div>
        <div class="hero-top">
          <div class="avatar-ring hero-avatar">
            <img v-if="profile.avatar" class="avatar" :src="imgUrl(profile.avatar)" alt="avatar" />
            <span v-else class="avatar-fallback">{{ avatarChar }}</span>
          </div>
          <div class="hero-identity">
            <h1 class="hero-nickname">{{ profile.nickname || profile.username || '尘间过客' }}</h1>
            <p class="hero-username">@{{ profile.username || 'guest' }}</p>
            <p class="hero-bio">{{ profile.bio || '此人尚无简介，只留一卷空白待叙。' }}</p>
            <p class="hero-joined" v-if="profile.createTime">入阁 · {{ joinDate }}</p>
          </div>
          <div class="hero-actions">
            <template v-if="isOther">
              <el-button
                class="friend-btn"
                :class="{ sent: friendState !== 'none' }"
                :disabled="friendRequesting || friendState !== 'none'"
                @click="applyFriend"
              >
                <template v-if="friendState === 'friend'">已是好友</template>
                <template v-else-if="friendState === 'sent'">已申请</template>
                <template v-else-if="friendRequesting">申请中…</template>
                <template v-else>申请好友</template>
              </el-button>
              <el-button class="wall-btn" @click="router.push(`/photowall/${targetUserId}`)">TA 的照片墙</el-button>
            </template>
            <template v-else>
              <el-button class="wall-btn" @click="router.push('/photowall')">我的照片墙</el-button>
              <el-button class="edit-btn" @click="openEdit">编辑资料</el-button>
              <el-button class="pwd-btn" @click="openPassword">修改密码</el-button>
            </template>
          </div>
        </div>

        <!-- 统计数据 -->
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-num">{{ profile.momentCount ?? 0 }}</span>
            <span class="stat-label">发布</span>
          </div>
          <span class="stat-divider"></span>
          <div class="stat-item">
            <span class="stat-num">{{ profile.likeCount ?? 0 }}</span>
            <span class="stat-label">获赞</span>
          </div>
          <span class="stat-divider"></span>
          <div class="stat-item">
            <span class="stat-num">{{ profile.collectCount ?? 0 }}</span>
            <span class="stat-label">收藏</span>
          </div>
        </div>
      </header>

      <!-- ============ 内容标签页 ============ -->
      <section class="profile-content nr-card">
        <div class="tab-bar">
          <span
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-item"
            :class="{ active: activeTab === tab.key }"
            @click="switchTab(tab.key)"
          >{{ tab.label }}</span>
        </div>

        <div class="tab-body" v-loading="loading">
          <!-- 动态卡片列表（三个标签复用同一套卡片组件） -->
          <div v-if="list.length" class="card-list">
            <MomentCard v-for="m in list" :key="m.id" :moment="m" variant="ink">
              <!-- 我的发布：卡片里多两个管理入口，其余与话题页完全一致 -->
              <template v-if="activeTab === 'moments' && !isOther" #meta-extra>
                <span class="meta-chip meta-chip--act" @click.stop="editMoment(m)">编辑</span>
                <span class="meta-chip meta-chip--act" @click.stop="removeMoment(m)">删除</span>
              </template>
            </MomentCard>

            <div class="load-more" v-if="hasMore && !loading">
              <el-button @click="loadMore">载入更多</el-button>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else-if="!loading" class="empty">
            <span class="seal empty-seal">空</span>
            <p class="empty-title">{{ emptyText }}</p>
            <p class="empty-sub">尘间尚有留白，静待落笔成叙</p>
            <button v-if="!isOther && activeTab === 'moments'" class="empty-clear" @click="router.push('/publish')">去发布</button>
          </div>
        </div>
      </section>
    </div>

    <!-- ============ 编辑资料对话框 ============ -->
    <el-dialog v-model="editVisible" title="编辑资料" width="440px" class="profile-dialog" destroy-on-close>
      <el-form :model="editForm" label-position="top" class="dialog-form">
        <el-form-item label="昵称">
          <el-input v-model="editForm.nickname" maxlength="64" placeholder="你的江湖名号" />
        </el-form-item>
        <el-form-item label="头像地址">
          <el-input v-model="editForm.avatar" placeholder="图片 URL（留空则显示首字）" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editForm.email" maxlength="128" placeholder="选填" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="editForm.bio" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="写一句关于自己的话" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- ============ 修改密码对话框 ============ -->
    <el-dialog v-model="pwdVisible" title="修改密码" width="440px" class="profile-dialog" destroy-on-close>
      <el-form :model="pwdForm" label-position="top" class="dialog-form">
        <el-form-item label="原密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入原密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="6-64 位" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="再输一次新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitPassword">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import MomentCard from '../components/MomentCard.vue'
import { imgUrl } from '../utils/url'
import {
  getMyProfile, updateMyProfile, changeMyPassword,
  getMyMoments, getMyLikes, getMyCollects,
  getUserProfile, getUserMoments,
} from '../utils/profileApi'
import { myFriends, sentRequests, requestFriend } from '../utils/friendshipApi'

const router = useRouter()
const route = useRoute()

/* ---------------- 视角：我的 / TA 的 ---------------- */
const targetUserId = computed(() => route.params.userId ? Number(route.params.userId) : null)
const isOther = computed(() => targetUserId.value !== null && targetUserId.value !== meId())
function meId() {
  try {
    const token = localStorage.getItem('token') || ''
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Number(payload.sub)
  } catch (e) {
    return null
  }
}

/* ---------------- 好友状态（他人主页） ---------------- */
// friendState: none(可申请) | sent(我已申请) | friend(已是好友)
const friendState = ref('none')
const friendRequesting = ref(false)

async function checkFriendState() {
  if (!isOther.value) return
  const me = meId()
  const target = targetUserId.value
  if (!me || !target) {
    friendState.value = 'none'
    return
  }
  try {
    // 一次查好友列表判断是否已好友；再查我发出的申请
    const [friends, sent] = await Promise.all([myFriends(), sentRequests()])
    if (friends.some((f) => f.id === target)) {
      friendState.value = 'friend'
    } else if (sent.some((f) => f.id === target)) {
      friendState.value = 'sent'
    } else {
      friendState.value = 'none'
    }
  } catch (e) {
    friendState.value = 'none'
  }
}

async function applyFriend() {
  if (friendState.value !== 'none' || friendRequesting.value) return
  friendRequesting.value = true
  try {
    await requestFriend(targetUserId.value)
    friendState.value = 'sent'
  } catch (e) {
    // 拦截器已提示
  } finally {
    friendRequesting.value = false
  }
}

/* ---------------- 资料与统计 ---------------- */
const profile = ref({})
const avatarChar = computed(() => {
  const n = (profile.value.nickname || profile.value.username || '').trim()
  return n ? n.charAt(0).toUpperCase() : '尘'
})
const joinDate = computed(() => {
  const t = profile.value.createTime
  if (!t) return ''
  const d = new Date(t)
  return isNaN(d.getTime()) ? String(t) : `${d.getFullYear()}年${d.getMonth() + 1}月`
})

/* ---------------- 标签页与列表 ---------------- */
const myTabs = [
  { key: 'moments', label: '我的发布' },
  { key: 'likes', label: '我点赞' },
  { key: 'collects', label: '我收藏' },
]
const otherTabs = [{ key: 'moments', label: 'TA 的发布' }]
const tabs = computed(() => (isOther.value ? otherTabs : myTabs))
const activeTab = ref('moments')
const list = ref([])
const loading = ref(false)
const page = ref(1)
const size = 10
const hasMore = ref(false)

const emptyText = computed(() => {
  if (isOther.value) return 'TA 尚未发布任何故事'
  return {
    moments: '尚未发布任何故事',
    likes: '还没有点赞过任何故事',
    collects: '还没有收藏过任何故事',
  }[activeTab.value]
})

async function fetchProfile() {
  try {
    profile.value = isOther.value
      ? (await getUserProfile(targetUserId.value) || {})
      : (await getMyProfile() || {})
  } catch (err) {
    // 统一拦截器已提示
  }
}

/* 连点标签页 / 载入更多时会有多个请求在路上，回来的顺序不保证；
   seq 对号，过期响应直接丢，避免「切到收藏却显示点赞」。 */
let listSeq = 0

async function fetchList(reset = true) {
  const seq = ++listSeq
  if (reset) {
    page.value = 1
    list.value = []
  }
  loading.value = true
  try {
    let data
    if (isOther.value) {
      data = await getUserMoments(targetUserId.value, page.value, size) || {}
    } else {
      const fetcher = { moments: getMyMoments, likes: getMyLikes, collects: getMyCollects }[activeTab.value]
      data = await fetcher(page.value, size) || {}
    }
    if (seq !== listSeq) return
    list.value = reset ? (data.records ?? []) : [...list.value, ...(data.records ?? [])]
    hasMore.value = data.current < data.pages
  } catch (err) {
  } finally {
    if (seq === listSeq) loading.value = false
  }
}

function switchTab(key) {
  if (activeTab.value === key) return
  activeTab.value = key
  fetchList(true)
}

async function loadMore() {
  if (loading.value || !hasMore.value) return
  page.value += 1
  await fetchList(false)
}

/* ---------------- 动态管理：编辑 / 删除（仅我的发布） ---------------- */
function editMoment(m) {
  router.push({ path: '/publish', query: { edit: m.id } })
}

async function removeMoment(m) {
  try {
    await ElMessageBox.confirm('删除后不可恢复，确定删除这条动态吗？', '删除动态', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await axios.delete(`/moments/${m.id}`)
    ElMessage.success('已删除')
    list.value = list.value.filter((x) => x.id !== m.id)
  } catch (err) {
    /* 错误提示由响应拦截器统一弹出 */
  }
}

/* ---------------- 编辑资料 ---------------- */
const editVisible = ref(false)
const saving = ref(false)
const editForm = reactive({ nickname: '', avatar: '', email: '', bio: '' })

function openEdit() {
  editForm.nickname = profile.value.nickname || ''
  editForm.avatar = profile.value.avatar || ''
  editForm.email = profile.value.email || ''
  editForm.bio = profile.value.bio || ''
  editVisible.value = true
}

async function submitEdit() {
  saving.value = true
  try {
    await updateMyProfile({
      nickname: editForm.nickname,
      avatar: editForm.avatar,
      email: editForm.email,
      bio: editForm.bio,
    })
    ElMessage.success('资料已更新')
    editVisible.value = false
    // 同步顶部用户名片
    localStorage.setItem('username', editForm.nickname || profile.value.username || '')
    await fetchProfile()
  } catch (err) {
  } finally {
    saving.value = false
  }
}

/* ---------------- 修改密码 ---------------- */
const pwdVisible = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

function openPassword() {
  pwdForm.oldPassword = ''
  pwdForm.newPassword = ''
  pwdForm.confirmPassword = ''
  pwdVisible.value = true
}

async function submitPassword() {
  if (!pwdForm.oldPassword || !pwdForm.newPassword) {
    ElMessage.warning('请填写完整')
    return
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  saving.value = true
  try {
    await changeMyPassword(pwdForm.oldPassword, pwdForm.newPassword)
    ElMessage.success('密码已修改，请重新登录')
    pwdVisible.value = false
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    router.push('/login')
  } catch (err) {
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  // 未登录直接引导登录
  if (!localStorage.getItem('token')) {
    router.push('/login')
    return
  }
  activeTab.value = 'moments'
  fetchProfile()
  fetchList(true)
  checkFriendState()
})

// 在同一组件内从 TA 的主页切换到另一个 TA 时重新加载
watch(targetUserId, () => {
  if (!localStorage.getItem('token')) return
  activeTab.value = 'moments'
  friendState.value = 'none'
  fetchProfile()
  fetchList(true)
  checkFriendState()
})
</script>

<style scoped>
.profile-wrap {
  max-width: 960px;
  margin: 0 auto;
  padding: 36px 16px 80px;
}

/* ============ 个人名片 ============ */
.profile-hero {
  position: relative;
  overflow: hidden;
  padding: 34px 38px 0;
  margin-bottom: 24px;
}
.hero-deco {
  position: absolute;
  top: 22px;
  right: 30px;
  opacity: .5;
}
.ornament-diamond {
  display: inline-block;
  width: 7px;
  height: 7px;
  transform: rotate(45deg);
  border: 1px solid var(--c-gold-dim);
}
.hero-top {
  display: flex;
  align-items: flex-start;
  gap: 22px;
}
.hero-avatar {
  flex-shrink: 0;
  width: 88px;
  height: 88px;
}
.avatar-ring {
  display: grid;
  place-items: center;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid var(--c-gold-dim);
  box-shadow: 0 0 0 4px var(--c-gold-faint);
  background: var(--fill);
}
.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-fallback {
  font-family: var(--font-brush);
  font-size: 40px;
  color: var(--c-gold);
}
.hero-identity {
  flex: 1;
  min-width: 0;
}
.hero-nickname {
  font-family: var(--font-brush);
  font-size: 30px;
  font-weight: 400;
  letter-spacing: 3px;
  color: #f5f5f5;
  margin: 2px 0 2px;
}
.hero-username {
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--c-gold-dim);
  margin: 0 0 10px;
}
.hero-bio {
  font-size: 13px;
  line-height: 1.7;
  color: var(--txt-2);
  margin: 0 0 8px;
}
.hero-joined {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--txt-3);
  margin: 0;
}
.hero-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}
.hero-actions .el-button {
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--txt-2);
  letter-spacing: 2px;
  margin: 0;
}
.hero-actions .wall-btn {
  border-color: var(--c-gold-dim);
  color: var(--c-gold);
}
.hero-actions .friend-btn {
  border-color: var(--c-gold-dim);
  color: var(--c-gold);
  background: rgba(232, 217, 181, 0.06);
}
.hero-actions .friend-btn.sent {
  opacity: 0.55;
  cursor: default;
  background: transparent;
}
.hero-actions .el-button:hover,
.hero-actions .el-button:focus {
  border-color: var(--c-gold-dim);
  color: var(--c-gold);
  background: var(--fill);
}

/* 统计条 */
.hero-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 48px;
  margin-top: 26px;
  padding: 18px 0;
  border-top: 1px solid var(--card-border);
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-num {
  font-size: 24px;
  font-weight: 600;
  color: var(--c-gold);
  line-height: 1;
}
.stat-label {
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--txt-3);
}
.stat-divider {
  width: 1px;
  height: 30px;
  background: var(--card-border);
}

/* ============ 内容标签 ============ */
.profile-content {
  padding: 0 34px 30px;
}
.tab-bar {
  display: flex;
  gap: 40px;
  border-bottom: 1px solid var(--card-border);
}
.tab-item {
  position: relative;
  padding: 18px 2px 14px;
  font-size: 14px;
  letter-spacing: 3px;
  color: var(--txt-3);
  cursor: pointer;
  transition: color .25s;
}
.tab-item:hover { color: var(--txt-1); }
.tab-item.active { color: var(--c-gold); }
.tab-item::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--c-gold);
  transform: scaleX(0);
  transition: transform .3s;
}
.tab-item.active::after { transform: scaleX(1); }
.tab-body {
  min-height: 220px;
  padding-top: 20px;
}

/* ============ 动态卡片 ============
   卡片本体在 <MomentCard variant="ink">，这里只留列表容器；
   下面 .meta-chip 是塞进卡片 #meta-extra 插槽的「编辑 / 删除」，
   插槽内容归属本组件作用域，所以要在这里单独着色。 */
.card-list { display: flex; flex-direction: column; gap: 16px; }
.tab-body .meta-chip {
  padding: 3px 10px;
  font-size: 12px;
  color: var(--txt-3);
  border: 1px solid var(--card-border);
  border-radius: 2px;
  background: rgba(255, 255, 255, .02);
}
.tab-body .meta-chip--act { cursor: pointer; transition: color .2s, border-color .2s; }
.tab-body .meta-chip--act:hover { color: var(--c-gold); border-color: var(--c-gold-dim); }

/* 载入更多 / 空状态 */
.load-more { display: flex; justify-content: center; padding: 18px 0; }
.load-more .el-button {
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--txt-2);
  letter-spacing: 3px;
}
.load-more .el-button:hover { border-color: var(--c-gold-dim); color: var(--c-gold); }
.empty { text-align: center; padding: 54px 0; }
.empty-seal { margin-bottom: 14px; }
.empty-title {
  font-family: var(--font-brush);
  font-size: 22px;
  color: var(--txt-1);
  letter-spacing: 2px;
  margin: 8px 0;
}
.empty-sub { font-size: 12px; color: var(--txt-3); margin: 0 0 18px; }
.empty-clear {
  background: transparent;
  border: 1px solid var(--c-gold-dim);
  color: var(--c-gold);
  padding: 7px 20px;
  letter-spacing: 3px;
  cursor: pointer;
  border-radius: 2px;
}
.empty-clear:hover { background: var(--fill); }

/* 对话框表单 */
.dialog-form :deep(.el-form-item__label) {
  color: var(--txt-2);
  font-size: 12px;
  letter-spacing: 2px;
}
.profile-dialog :deep(.el-dialog__title) {
  font-family: var(--font-brush);
  font-size: 22px;
  color: var(--c-gold);
  letter-spacing: 2px;
}

/* ---------- 窄屏 ----------
   名片原来是「头像 + 身份 + 三个竖排按钮」三列 nowrap：390px 下身份区
   只剩百来像素，昵称和简介被压成一字一行（简介 ∥ 着排成一条竖线）。
   窄屏改成两行——头像+身份一行，按钮整行横排均分。 */
@media (max-width: 760px) {
  .profile-wrap { padding: 20px 12px 64px; }
  .profile-hero { padding: 22px 18px 0; }
  .hero-top { flex-wrap: wrap; gap: 14px; }
  .hero-avatar { width: 64px; height: 64px; }
  .avatar-fallback { font-size: 30px; }
  .hero-nickname { font-size: 24px; letter-spacing: 2px; }
  .hero-bio { font-size: 12.5px; margin-bottom: 6px; }
  .hero-deco { display: none; }
  .hero-actions {
    flex: 1 0 100%;
    flex-direction: row;
    gap: 8px;
  }
  .hero-actions .el-button {
    flex: 1;
    margin: 0;
    padding: 0 4px;
    font-size: 12px;
    letter-spacing: 1px;
  }
  .hero-stats { gap: 0; margin-top: 18px; padding: 14px 0; }
  .stat-item { flex: 1; }
  .stat-label { letter-spacing: 2px; }

  .profile-content { padding: 0 16px 22px; }
  .tab-bar { gap: 26px; }
  .tab-item { font-size: 13px; letter-spacing: 2px; }
}
</style>
