// 通知接口封装：列表 / 未读数 / 标记已读
// BusinessException 是 HTTP 200 + body code，故这里保留完整 res 供调用方判断
import axios from 'axios'

const BASE = '/notifications'

/** 我的通知列表 */
export function getNotifications(page = 1, size = 20) {
  return axios.get(BASE, { params: { page, size } }).then((res) => res.data?.data)
}

/** 未读条数 */
export function getUnreadCount() {
  return axios.get(`${BASE}/unread`).then((res) => res.data?.data)
}

/** 标记单条已读 */
export function markNotificationRead(id) {
  return axios.post(`${BASE}/read`, null, { params: { id } }).then((res) => res.data)
}

/** 全部标记已读 */
export function markAllRead() {
  return axios.post(`${BASE}/read-all`).then((res) => res.data)
}
