/* src/utils/profileApi.js —— 个人中心 API 封装
   对应后端 ProfileController（/profile），全部需要登录：
     GET  /profile            我的资料 + 统计
     PUT  /profile            编辑资料
     PUT  /profile/password   修改密码
     GET  /profile/moments    我发布的动态
     GET  /profile/likes      我点赞的动态
     GET  /profile/collects   我收藏的动态

   baseURL 与 token 头由 main.js 全局配置与拦截器统一处理，这里只拆 Result.data。 */

import axios from 'axios'

const BASE = '/profile'

/** 我的资料 + 统计 */
export function getMyProfile() {
  return axios.get(BASE).then((res) => res.data?.data)
}

/** 编辑资料 */
export function updateMyProfile(data) {
  return axios.put(BASE, data).then((res) => res.data)
}

/** 修改密码 */
export function changeMyPassword(oldPassword, newPassword) {
  return axios.put(`${BASE}/password`, { oldPassword, newPassword }).then((res) => res.data)
}

/** 我发布的动态（分页） */
export function getMyMoments(page = 1, size = 10) {
  return axios.get(`${BASE}/moments`, { params: { page, size } }).then((res) => res.data?.data)
}

/** 我点赞的动态（分页） */
export function getMyLikes(page = 1, size = 10) {
  return axios.get(`${BASE}/likes`, { params: { page, size } }).then((res) => res.data?.data)
}

/** 我收藏的动态（分页） */
export function getMyCollects(page = 1, size = 10) {
  return axios.get(`${BASE}/collects`, { params: { page, size } }).then((res) => res.data?.data)
}

/** TA 的资料 + 统计（对外视角，已屏蔽邮箱） */
export function getUserProfile(userId) {
  return axios.get(`${BASE}/user/${userId}`).then((res) => res.data?.data)
}

/** TA 发布的动态（分页） */
export function getUserMoments(userId, page = 1, size = 10) {
  return axios.get(`${BASE}/user/${userId}/moments`, { params: { page, size } }).then((res) => res.data?.data)
}
