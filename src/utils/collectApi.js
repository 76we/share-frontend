/* src/utils/collectApi.js —— 收藏模块 API 封装
   对应后端 CollectController（/collects），只针对动态(moment)：
     POST /collects?momentId=        切换收藏（返回 1=收藏 / -1=取消）
     GET  /collects/state?momentId=  当前用户是否已收藏（需登录）
     GET  /collects/count?momentId=  收藏总数（公开）

   baseURL 与 token 头由 main.js 的全局配置统一处理，这里只拆出 Result.data。 */

import axios from 'axios'

const BASE = '/collects'

// count / state 属于「增强体验」的可选查询，失败时组件会用 initial 兜底，
// 不应弹红色错误刷屏。统一标记 silent，由 main.js 响应拦截器静默处理。

/** 收藏总数（Number） */
export function getCollectCount(momentId) {
  return axios.get(`${BASE}/count`, { params: { momentId }, silent: true })
    .then((res) => Number(res.data?.data ?? 0))
}

/** 当前用户是否已收藏（Boolean；未登录会 401，由调用方规避） */
export function getCollectState(momentId) {
  return axios.get(`${BASE}/state`, { params: { momentId }, silent: true })
    .then((res) => res.data?.data === true)
}

/** 切换收藏（返回 1=收藏成功，-1=取消收藏成功） */
export function toggleCollect(momentId) {
  return axios.post(BASE, null, { params: { momentId } })
    .then((res) => Number(res.data?.data))
}
