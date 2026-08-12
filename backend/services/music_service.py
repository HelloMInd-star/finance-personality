"""
网易云音乐服务 · music_service
==============================

功能：
1. 网易云音乐 API 代理（基于 NeteaseCloudMusicApi）
2. 歌单数据获取与分析
3. 用户音乐画像生成

注意：网易云没有官方开放 API，本模块通过以下方式工作：
- 如果本地部署了 NeteaseCloudMusicApi 服务，会自动代理请求
- 如果没有部署，使用模拟数据进行演示

NeteaseCloudMusicApi 部署：
1. git clone https://github.com/Binaryify/NeteaseCloudMusicApi.git
2. cd NeteaseCloudMusicApi && npm install
3. node app.js (默认端口 3000)
"""

import httpx
import asyncio
import random
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# NeteaseCloudMusicApi 默认地址
NETEASE_API_BASE = "http://localhost:3000"

# 网易云风格到本系统曲风映射
GENRE_MAP = {
    "流行": "pop",
    "摇滚": "rock",
    "电子": "electronic",
    "古典": "classical",
    "爵士": "jazz",
    "嘻哈": "hiphop",
    "民谣": "folk",
    "R&B": "rnb",
    "金属": "metal",
    "独立": "indie",
}


class NetEaseService:
    """网易云音乐服务"""

    def __init__(self, api_base: str = None):
        self.api_base = api_base or NETEASE_API_BASE
        self._available = None  # 缓存可用性检查

    async def _check_availability(self) -> bool:
        """检查 NeteaseCloudMusicApi 是否可用"""
        if self._available is not None:
            return self._available

        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.api_base}/search", params={"keywords": "test"})
                self._available = resp.status_code == 200
        except Exception:
            self._available = False
            logger.warning("网易云 API 不可用，将使用模拟数据")

        return self._available

    async def phone_login(self, phone: str, password: str) -> Dict[str, Any]:
        """手机号登录"""
        if await self._check_availability():
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        f"{self.api_base}/login/cellphone",
                        params={"phone": phone, "password": password}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        return {
                            "success": data.get("code") == 200,
                            "token": data.get("token"),
                            "user_info": data.get("profile"),
                            "message": "登录成功" if data.get("code") == 200 else data.get("message", "登录失败"),
                        }
            except Exception as e:
                logger.error(f"网易云登录失败: {e}")

        # 回退：模拟登录
        return {
            "success": True,
            "token": "mock_token_" + phone,
            "user_info": {
                "nickname": f"用户_{phone[-4:]}",
                "avatar_url": "",
                "user_id": int(phone) if phone.isdigit() else 100000,
            },
            "message": "登录成功（演示模式）",
            "demo_mode": True,
        }

    async def get_user_playlists(self, token: str, uid: int = None) -> Dict[str, Any]:
        """获取用户歌单"""
        if await self._check_availability() and uid:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        f"{self.api_base}/user/playlist",
                        params={"uid": uid},
                        headers={"Cookie": f"token={token}"}
                    )
                    if resp.status_code == 200:
                        return {"success": True, "playlists": resp.json().get("playlist", [])}
            except Exception as e:
                logger.error(f"获取歌单失败: {e}")

        # 回退：模拟歌单数据
        return {
            "success": True,
            "playlists": self._generate_mock_playlists(),
            "demo_mode": True,
        }

    async def get_playlist_tracks(self, playlist_id: int, token: str = None) -> Dict[str, Any]:
        """获取歌单曲目"""
        if await self._check_availability():
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    params = {"id": playlist_id}
                    headers = {}
                    if token:
                        headers["Cookie"] = f"token={token}"

                    resp = await client.get(
                        f"{self.api_base}/playlist/tracks",
                        params=params,
                        headers=headers
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        tracks = data.get("songs", [])
                        # 转换为统一格式
                        normalized = [self._normalize_track(t) for t in tracks]
                        return {"success": True, "tracks": normalized}
            except Exception as e:
                logger.error(f"获取曲目失败: {e}")

        # 回退：模拟曲目数据
        return {
            "success": True,
            "tracks": self._generate_mock_tracks(playlist_id),
            "demo_mode": True,
        }

    def _normalize_track(self, track: Dict) -> Dict:
        """标准化曲目数据"""
        artists = track.get("ar", [])
        return {
            "id": track.get("id"),
            "name": track.get("name", "未知歌曲"),
            "artists": [{"name": a.get("name", "未知艺术家"), "id": a.get("id")} for a in artists],
            "album": track.get("al", {}).get("name", "未知专辑"),
            "duration": track.get("dt", 0),
            "genre": None,
            "bpm": None,
            "year": None,
            "emotion": None,
        }

    async def get_song_url(self, song_id: int, token: str = None) -> Dict[str, Any]:
        """获取歌曲播放 URL"""
        if await self._check_availability():
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    params = {"id": song_id, "level": "standard"}
                    headers = {}
                    if token:
                        headers["Cookie"] = f"token={token}"

                    resp = await client.get(
                        f"{self.api_base}/song/url",
                        params=params,
                        headers=headers
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        url_data = data.get("data", [{}])[0]
                        if url_data.get("url"):
                            return {
                                "success": True,
                                "url": url_data["url"],
                                "br": url_data.get("br", 128000),
                                "size": url_data.get("size", 0),
                            }
                        else:
                            return {
                                "success": False,
                                "message": "该歌曲暂无版权或需要 VIP",
                                "reason": url_data.get("exclusive") and "exclusive" or "no_url",
                            }
            except Exception as e:
                logger.error(f"获取歌曲URL失败: {e}")

        # 回退：返回空
        return {"success": False, "message": "API 不可用"}

    def _generate_mock_playlists(self) -> List[Dict]:
        """生成模拟歌单"""
        return [
            {
                "id": 1,
                "name": "我的最爱",
                "track_count": 50,
                "cover_url": "",
                "description": "收藏的歌曲",
            },
            {
                "id": 2,
                "name": "工作专注",
                "track_count": 30,
                "cover_url": "",
                "description": "工作时听的音乐",
            },
            {
                "id": 3,
                "name": "运动节拍",
                "track_count": 25,
                "cover_url": "",
                "description": "健身时听的音乐",
            },
            {
                "id": 4,
                "name": "深夜沉思",
                "track_count": 20,
                "cover_url": "",
                "description": "思考时听的音乐",
            },
        ]

    def _generate_mock_tracks(self, playlist_id: int) -> List[Dict]:
        """生成模拟曲目数据"""
        # 根据歌单 ID 生成不同风格的曲目
        genre_distributions = {
            1: [("流行", 0.4), ("摇滚", 0.3), ("电子", 0.2), ("古典", 0.1)],
            2: [("古典", 0.5), ("爵士", 0.3), ("民谣", 0.2)],
            3: [("电子", 0.4), ("摇滚", 0.3), ("嘻哈", 0.2), ("金属", 0.1)],
            4: [("民谣", 0.4), ("古典", 0.3), ("爵士", 0.3)],
        }

        emotions = ["joyful", "calm", "energetic", "melancholic", "romantic", "dreamy"]

        tracks = []
        dist = genre_distributions.get(playlist_id, genre_distributions[1])
        count = random.randint(20, 40)

        for i in range(count):
            # 根据分布选择风格
            r = random.random()
            cumulative = 0
            genre_name = dist[0][0]
            for g, p in dist:
                cumulative += p
                if r <= cumulative:
                    genre_name = g
                    break

            # 映射到系统曲风
            system_genre = GENRE_MAP.get(genre_name, "pop")

            # 生成 BPM
            bpm_ranges = {
                "pop": (90, 120),
                "rock": (120, 160),
                "electronic": (120, 180),
                "classical": (60, 120),
                "jazz": (80, 140),
                "hiphop": (80, 110),
                "folk": (70, 110),
                "metal": (140, 200),
                "indie": (80, 130),
            }
            bpm_low, bpm_high = bpm_ranges.get(system_genre, (90, 130))
            bpm = random.randint(bpm_low, bpm_high)

            tracks.append({
                "id": playlist_id * 1000 + i,
                "name": f"模拟歌曲 {i+1}",
                "artists": [{"name": f"艺术家_{random.randint(1, 10)}", "id": random.randint(1000, 9999)}],
                "album": f"专辑_{random.randint(1, 20)}",
                "duration": random.randint(180, 300),
                "genre": system_genre,
                "bpm": bpm,
                "year": random.choice([2018, 2019, 2020, 2021, 2022, 2023, 2024]),
                "emotion": random.choice(emotions),
            })

        return tracks


# 单例
netease_service = NetEaseService()


async def analyze_music_profile(
    token: str = None,
    uid: int = None,
    playlist_ids: List[int] = None,
) -> Dict[str, Any]:
    """
    分析用户音乐画像
    汇总多个歌单数据，生成完整的音乐画像

    Args:
        token: 网易云 token
        uid: 用户 ID
        playlist_ids: 指定歌单 ID 列表（可选，默认获取全部）

    Returns:
        音乐画像数据
    """
    logger.info(f"开始分析音乐画像: uid={uid}, playlists={playlist_ids}")

    # 1. 获取歌单列表
    demo_mode = False
    if not playlist_ids:
        playlists_resp = await netease_service.get_user_playlists(token or "", uid)
        if not playlists_resp.get("success"):
            return {"success": False, "error": "获取歌单失败"}
        playlist_ids = [p["id"] for p in playlists_resp.get("playlists", [])]
        demo_mode = playlists_resp.get("demo_mode", False)

    # 2. 获取所有曲目
    all_tracks = []
    for pid in playlist_ids[:5]:  # 限制最多 5 个歌单
        tracks_resp = await netease_service.get_playlist_tracks(pid, token)
        if tracks_resp.get("success"):
            all_tracks.extend(tracks_resp.get("tracks", []))

    if not all_tracks:
        return {"success": False, "error": "没有获取到曲目数据"}

    # 3. 生成画像（返回原始数据，由前端 musicProfileEngine 处理）
    profile_data = {
        "success": True,
        "source": "netease" if not demo_mode else "demo",
        "total_tracks": len(all_tracks),
        "playlists_analyzed": len(playlist_ids[:5]),
        "tracks": all_tracks,
        "analyzed_at": datetime.now().isoformat(),
    }

    logger.info(f"音乐画像分析完成: {len(all_tracks)} 首歌曲")
    return profile_data


def get_service_status() -> Dict[str, Any]:
    """获取服务状态（动态检查）"""
    available = netease_service._available
    if available is None:
        # 未检查过，返回未知状态
        return {
            "netease_api_available": "checking",
            "netease_api_base": netease_service.api_base,
            "demo_mode": False,  # 等待检查
        }
    return {
        "netease_api_available": available,
        "netease_api_base": netease_service.api_base,
        "demo_mode": not available,  # 只有 API 不可用时才是演示模式
    }
