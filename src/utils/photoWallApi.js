/* src/utils/photoWallApi.js —— 照片墙 API 封装
   对应后端 PhotoWallController（/profile/photos），全部需要登录：
     GET /profile/photos              我的照片墙（动态带图自动汇入）
     GET /profile/photos/anniversary  那年今日（往年同一天发布的照片）
     GET /profile/photos/visibility   我的照片墙可见性（0私密 1公开）
     PUT /profile/photos/visibility   设置可见性
     GET /profile/photos/user/:id     访问 TA 的照片墙（私密则拒绝）

   点赞走 likeApi.js 的 toggleLike(targetId, 3)，targetType=3 表示照片。
   baseURL 与 token 头由 main.js 全局配置与拦截器统一处理，这里只拆 Result.data。 */

import axios from 'axios'

const BASE = '/profile/photos'

/** 我的照片墙（分页），返回 { records, total, ... } */
export function getMyPhotos(page = 1, size = 12) {
  return axios.get(BASE, { params: { page, size } }).then((res) => res.data?.data)
}

/** 那年今日（分页），records 中每张带 yearsAgo（距今几年） */
export function getAnniversaryPhotos(page = 1, size = 12) {
  return axios.get(`${BASE}/anniversary`, { params: { page, size } })
    .then((res) => res.data?.data)
}

/** 我的照片墙可见性：0=私密 1=公开 */
export function getPhotoWallVisibility() {
  return axios.get(`${BASE}/visibility`).then((res) => res.data?.data)
}

/** 设置我的照片墙可见性：0=私密 1=公开 */
export function setPhotoWallVisibility(visibility) {
  return axios.put(`${BASE}/visibility`, null, { params: { visibility } })
    .then((res) => res.data)
}

/** 访问 TA 的照片墙（私密时后端返回 code=400） */
export function getOtherPhotos(userId, page = 1, size = 12) {
  return axios.get(`${BASE}/user/${userId}`, { params: { page, size } })
    .then((res) => res.data?.data)
}

/* ---------- 按月分区间视图（不分页） ---------- */

/** 我的照片墙按月分组：返回 [{ year, month, label, count, photos }] */
export function getMyPhotosGrouped() {
  return axios.get(`${BASE}/groups`).then((res) => res.data?.data)
}

/** 那年今日按月分组 */
export function getAnniversaryPhotosGrouped() {
  return axios.get(`${BASE}/anniversary/groups`).then((res) => res.data?.data)
}

/** 访问 TA 的照片墙按月分组（私密时后端返回 code=400） */
export function getOtherPhotosGrouped(userId) {
  return axios.get(`${BASE}/user/${userId}/groups`).then((res) => res.data?.data)
}

/** 年度回忆册：某年照片按月分组 */
export function getYearPhotosGrouped(year) {
  return axios.get(`${BASE}/year/${year}/groups`).then((res) => res.data?.data)
}

/* ---------- 好友墙聚合 ---------- */

/**
 * 好友墙：每位好友近期照片，按好友分段。
 * 返回 [{ friendId, friendName, friendAvatar, totalCount, photos: WallPhotoVO[] }]
 * 每段最多 limit 张；私密墙的好友不会出现在结果里。
 */
export function getFriendPhotos(limit = 6) {
  return axios.get(`${BASE}/friends`, { params: { limit } }).then((res) => res.data?.data)
}
