/* src/utils/friendshipApi.js —— 好友关系 API 封装
   对应后端 FriendController（/friendships），全部需登录：
     GET  /friendships/search?keyword=   搜人（昵称/用户名）
     POST /friendships/request?userId=   发起申请
     POST /friendships/accept?userId=    同意
     POST /friendships/reject?userId=    拒绝
     GET  /friendships                   我的好友列表
     GET  /friendships/incoming          我收到的申请
     GET  /friendships/sent              我发出的申请

   FriendSearchVO: { id, username, nickname, avatar, bio, relation(0无/1好友/2我申请中/3对方申请我) }
   FriendVO:       { id, username, nickname, avatar, bio, relation(0申请中/1好友), fromUser } */

import axios from 'axios'

const BASE = '/friendships'

export function searchFriend(keyword) {
  return axios.get(`${BASE}/search`, { params: { keyword } }).then((r) => r.data?.data || [])
}

export function requestFriend(userId) {
  return axios.post(`${BASE}/request`, null, { params: { userId } }).then((r) => r.data)
}

export function acceptFriend(userId) {
  return axios.post(`${BASE}/accept`, null, { params: { userId } }).then((r) => r.data)
}

export function rejectFriend(userId) {
  return axios.post(`${BASE}/reject`, null, { params: { userId } }).then((r) => r.data)
}

export function myFriends() {
  return axios.get(BASE).then((r) => r.data?.data || [])
}

export function incomingRequests() {
  return axios.get(`${BASE}/incoming`).then((r) => r.data?.data || [])
}

export function sentRequests() {
  return axios.get(`${BASE}/sent`).then((r) => r.data?.data || [])
}
