/**
 * 网易云音乐 API 客户端
 * 对接后端 /api/music/* 接口
 */
import { apiClient } from './apiClient';
import { logger } from './logger';

/**
 * 获取音乐服务状态
 */
export async function getMusicStatus() {
  return apiClient.get('/music/status');
}

/**
 * 网易云手机号登录
 */
export async function neteaseLogin(phone, password) {
  logger.session('[音乐] 网易云登录', { phone });
  return apiClient.post('/music/netease/login', { phone, password });
}

/**
 * 获取用户歌单列表
 */
export async function getUserPlaylists(token, uid) {
  const params = { token };
  if (uid) params.uid = uid;
  return apiClient.get('/music/netease/playlists', params);
}

/**
 * 获取歌单曲目
 */
export async function getPlaylistTracks(playlistId, token) {
  const params = {};
  if (token) params.token = token;
  return apiClient.get(`/music/netease/playlist/${playlistId}`, params);
}

/**
 * 分析音乐画像
 */
export async function analyzeMusicProfile(payload) {
  logger.session('[音乐] 分析画像', {
    playlistCount: payload.playlist_ids?.length || 0,
  });
  return apiClient.post('/music/analyze', payload);
}

/**
 * 获取歌曲播放 URL
 */
export async function getSongUrl(id, token) {
  logger.session('[音乐] 获取歌曲URL', { id });
  const params = { id };
  if (token) params.token = token;
  return apiClient.get('/music/song/url', params);
}
