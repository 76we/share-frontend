// 相册接口封装：相册列表 + 相册内照片 + 增删改
// 走全局 axios（baseURL / token 拦截器在 main.js 中统一配置）
import axios from 'axios'

/** 我的相册列表（含封面前三张与照片数量） */
export function getAlbums() {
  return axios.get('/albums').then((res) => res.data?.data)
}

/** 指定相册下的全部照片 */
export function getAlbumPhotos(albumId) {
  return axios.get(`/albums/${albumId}/photos`).then((res) => res.data?.data)
}

/** 新建相册 */
export function createAlbum(title, description) {
  return axios.post('/albums', null, { params: { title, description } })
    .then((res) => res.data)
}

/** 修改相册标题/简介 */
export function updateAlbum(albumId, title, description) {
  return axios.put(`/albums/${albumId}`, null, { params: { title, description } })
    .then((res) => res.data)
}

/** 删除相册 */
export function deleteAlbum(albumId) {
  return axios.delete(`/albums/${albumId}`).then((res) => res.data)
}

/** 从照片墙选一张图加入相册 */
export function addPhotoToAlbum(albumId, photoUrl, caption) {
  return axios.post(`/albums/${albumId}/photos`, null, { params: { photoUrl, caption } })
    .then((res) => res.data)
}

/** 删除相册内一张照片 */
export function removePhotoFromAlbum(photoId) {
  return axios.delete(`/albums/photos/${photoId}`).then((res) => res.data)
}
