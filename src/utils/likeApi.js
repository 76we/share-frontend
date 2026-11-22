/* src/utils/likeApi.js —— 点赞模块 API 封装
   对应后端 LikeController（/likes）：
     POST /likes?targetId=&targetType=        切换点赞（返回 1=点赞 / -1=取消）
     GET  /likes/state?targetId=&targetType=  当前用户是否已点赞（需登录）
     GET  /likes/count?targetId=&targetType=  点赞总数（公开）

   baseURL 与 token 请求头由 main.js 的全局配置和拦截器统一处理，这里只负责
   发请求并拆出 Result.data，让调用方拿到干净的业务值。 */

import axios from 'axios'

const BASE = '/likes'

// 说明：count / state 属于「增强体验」的可选查询——失败时组件会用 initial 兜底，
// 不应弹红色错误刷屏。这里统一标记 silent，由 main.js 响应拦截器静默处理。

/** 点赞总数（返回 Number） */
export function getLikeCount(targetId, targetType) {
  return axios.get(`${BASE}/count`, { params: { targetId, targetType }, silent: true })
    .then((res) => Number(res.data?.data ?? 0))
}

/** 当前用户是否已点赞（返回 Boolean；未登录会 401，由调用方规避） */
export function getLikeState(targetId, targetType) {
  return axios.get(`${BASE}/state`, { params: { targetId, targetType }, silent: true })
    .then((res) => res.data?.data === true)
}

/** 切换点赞（返回 1=点赞成功，-1=取消点赞成功） */
export function toggleLike(targetId, targetType) {
  return axios.post(BASE, null, { params: { targetId, targetType } })
    .then((res) => Number(res.data?.data))
}
