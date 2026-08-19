"""
Poker Egg 后端主程序
FastAPI + WebSocket 实时通信
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Any
import json
import asyncio
import uuid
import os
from datetime import datetime, timedelta
import logging

# 导入自定义模块
from services.game_engine import GameEngine, Player, Card
from ai.ai_engine import PokerAI, AIDecisionMaker
from models.database import Database
from models.schemas import (
    UserCreate, UserLogin, Token, GameCreate, GameJoin,
    PlayerAction, GameState, PlayerStats, DevelopmentPlanGenerate,
    BartenderSessionCreate, BartenderSessionUpdate
)
from auth.auth import AuthHandler
from pydantic import BaseModel
import httpx
from services.development_service import generate_development_plan
from services.eastmoneyData import (
    get_realtime_quote, get_daily_kline, get_valuation_factors, normalize_symbol,
)
from services.music_service import (
    netease_service, analyze_music_profile, get_service_status as get_music_service_status,
)

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================
# FastAPI 应用初始化
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info("🚀 Poker Egg 服务器启动中...")
    await Database.connect()
    logger.info("✅ 数据库连接成功")
    yield
    # 关闭时
    await Database.disconnect()
    logger.info("🛑 Finance Personality 服务器已关闭")

app = FastAPI(
    title="Y.Mine Finance Personality API",
    description="人格金融孪生平台 - 决策人格 × 金融智能",
    version="1.0.0",
    lifespan=lifespan
)

# ============================================
# CORS 配置
# ============================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:5174,https://hellomind-star.github.io"
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# 依赖注入
# ============================================

auth_handler = AuthHandler()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# ============================================
# 全局状态管理
# ============================================

class GameManager:
    """游戏管理器 - 管理所有游戏会话"""
    
    def __init__(self):
        self.games: Dict[str, GameEngine] = {}
        # game_id -> {player_id: websocket},支持每个游戏多个玩家连接
        self.connections: Dict[str, Dict[str, WebSocket]] = {}
        self.players: Dict[str, Dict] = {}  # player_id -> {game_id, name}
        self.ai_decision_maker = AIDecisionMaker()
        self._ai_tasks: Dict[str, asyncio.Task] = {}  # 持有 AI 任务引用防止 GC
    
    def create_game(self, player_name: str, ai_difficulty: str = "medium") -> Dict:
        """创建新游戏"""
        game = GameEngine()
        
        # 添加玩家
        player = game.add_player(player_name, is_ai=False)
        
        # 添加AI玩家
        ai_player = game.add_player("AI Bot", is_ai=True, ai_difficulty=ai_difficulty)
        
        self.games[game.id] = game
        
        return {
            "game_id": game.id,
            "player_id": player.id,
            "ai_player_id": ai_player.id,
            "game_state": game.get_state()
        }
    
    def join_game(self, game_id: str, player_name: str) -> Optional[Dict]:
        """加入游戏"""
        game = self.games.get(game_id)
        if not game:
            return None
        
        # 检查是否已满（最多6人）
        if len([p for p in game.players if not p.is_ai]) >= 5:
            return {"error": "游戏已满"}
        
        player = game.add_player(player_name, is_ai=False)
        
        return {
            "game_id": game.id,
            "player_id": player.id,
            "game_state": game.get_state()
        }
    
    def add_ai_player(self, game_id: str, difficulty: str = "medium") -> Optional[Dict]:
        """添加AI玩家"""
        game = self.games.get(game_id)
        if not game:
            return None
        
        ai_player = game.add_player(f"AI Bot {len([p for p in game.players if p.is_ai]) + 1}", 
                                   is_ai=True, ai_difficulty=difficulty)
        
        return {
            "player_id": ai_player.id,
            "game_state": game.get_state()
        }
    
    def get_game(self, game_id: str) -> Optional[GameEngine]:
        """获取游戏"""
        return self.games.get(game_id)
    
    def list_games(self) -> List[Dict]:
        """获取所有游戏列表"""
        result = []
        for game in self.games.values():
            state = game.get_state()
            human_players = [p for p in state["players"] if not p["is_ai"]]
            result.append({
                "id": game.id,
                "name": f"房间 #{game.id}",
                "players": len(human_players),
                "maxPlayers": 6,
                "status": "playing" if not game.hand_over else "waiting",
                "aiDifficulty": state["players"][1]["ai_difficulty"] if len(state["players"]) > 1 else "medium",
                "createdAt": game.created_at.strftime("%Y-%m-%d %H:%M")
            })
        return result
    
    def remove_game(self, game_id: str):
        """移除游戏"""
        if game_id in self.games:
            del self.games[game_id]
        if game_id in self.connections:
            del self.connections[game_id]
    
    def register_connection(self, game_id: str, player_id: str, websocket: WebSocket):
        """注册WebSocket连接(按 player_id 索引,支持同游戏多玩家)"""
        if game_id not in self.connections:
            self.connections[game_id] = {}
        self.connections[game_id][player_id] = websocket

    def unregister_connection(self, game_id: str, player_id: str = None):
        """注销WebSocket连接"""
        if game_id not in self.connections:
            return
        if player_id:
            self.connections[game_id].pop(player_id, None)
        if player_id is None or not self.connections[game_id]:
            self.connections.pop(game_id, None)

    async def broadcast(self, game_id: str, message: Dict):
        """广播相同消息给游戏中的所有玩家"""
        conns = self.connections.get(game_id, {})
        for websocket in list(conns.values()):
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"广播失败: {e}")

    async def broadcast_game_state(self, game_id: str):
        """按每个玩家视角广播游戏状态(隐藏他人底牌,防止作弊)"""
        game = self.games.get(game_id)
        if not game:
            return
        conns = self.connections.get(game_id, {})
        for player_id, websocket in list(conns.items()):
            try:
                await websocket.send_json({
                    "type": "game_state",
                    "data": game.get_state(viewer_id=player_id)
                })
            except Exception as e:
                logger.error(f"广播状态失败: {e}")

    def schedule_ai_turn(self, game_id: str):
        """调度AI回合任务,持有引用防止被GC,异常会被记录"""
        old = self._ai_tasks.get(game_id)
        if old and not old.done():
            old.cancel()

        task = asyncio.create_task(self.process_ai_turn(game_id))
        self._ai_tasks[game_id] = task
        task.add_done_callback(lambda t: self._on_ai_task_done(game_id, t))

    def _on_ai_task_done(self, game_id: str, task: asyncio.Task):
        self._ai_tasks.pop(game_id, None)
        if task.cancelled():
            return
        exc = task.exception()
        if exc:
            logger.error(f"AI回合任务异常: {exc}")
    
    async def process_ai_turn(self, game_id: str):
        """处理AI回合"""
        game = self.games.get(game_id)
        if not game:
            return
        
        ai_player = game.get_ai_player()
        if not ai_player:
            return
        
        # 广播思考状态
        await self.broadcast(game_id, {
            "type": "ai_thinking",
            "data": {"player": ai_player.name}
        })
        
        # 等待一下模拟思考
        await asyncio.sleep(ai_player.ai_difficulty == "hard" and 2.0 or 1.2)
        
        # 获取AI决策
        ai = self.ai_decision_maker.get_ai(ai_player.ai_difficulty)
        
        # 构建AI视角状态
        ai_state = {
            "hole_cards": [c.to_dict() for c in ai_player.hole_cards],
            "board_cards": [c.to_dict() for c in game.board],
            "pot": game.pot,
            "my_chips": ai_player.chips,
            "current_bet": max([p.bet for p in game.players if not p.folded] or [0]),
            "position": "late",
            "stage": game.stage.value
        }
        
        # AI决策
        decision = ai.decide_action(ai_state)
        
        # 执行AI行动
        result = game.process_action(ai_player.id, decision["action"], decision.get("amount", 0))
        
        if result["success"]:
            # 广播更新
            await self.broadcast(game_id, {
                "type": "ai_action",
                "data": {
                    "player": ai_player.name,
                    "action": decision["action"],
                    "amount": decision.get("amount", 0),
                    "message": result["message"]
                }
            })
            
            # 广播游戏状态(按玩家视角,隐藏他人底牌)
            await self.broadcast_game_state(game_id)

            # 检查游戏是否结束
            if game.hand_over:
                await self.broadcast(game_id, {
                    "type": "hand_over",
                    "data": {
                        "winner": game.winner.to_dict() if game.winner else None,
                        "pot": game.pot
                    }
                })
                
                # 自动开始下一局（延迟2秒）
                await asyncio.sleep(2)
                game.start_new_hand()
                await self.broadcast_game_state(game_id)
                await self.broadcast(game_id, {
                    "type": "system_message",
                    "data": {"message": "🔄 新的一局开始"}
                })

game_manager = GameManager()

# ============================================
# API 路由
# ============================================

@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "Y.Mine Finance Personality API",
        "version": "1.0.0",
        "status": "running",
        "documentation": "/docs",
        "websocket": "wss://finance-personality-api-production.up.railway.app/ws/{game_id}"
    }

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "games": len(game_manager.games),
        "connections": len(game_manager.connections)
    }

# ============================================
# 游戏 API
# ============================================

@app.get("/api/games")
async def list_games():
    """获取所有游戏列表"""
    return {
        "success": True,
        "data": game_manager.list_games()
    }

@app.post("/api/game/create")
async def create_game(request: GameCreate):
    """创建新游戏"""
    try:
        result = game_manager.create_game(
            player_name=request.player_name or "Player",
            ai_difficulty=request.ai_difficulty or "medium"
        )
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        logger.error(f"创建游戏失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/game/{game_id}/join")
async def join_game(game_id: str, request: GameJoin):
    """加入游戏"""
    result = game_manager.join_game(game_id, request.player_name or "Player")
    if not result:
        raise HTTPException(status_code=404, detail="游戏不存在")
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {
        "success": True,
        "data": result
    }

@app.get("/api/game/{game_id}")
async def get_game_state(game_id: str, player_id: str = None):
    """获取游戏状态(传入 player_id 时隐藏他人底牌)"""
    game = game_manager.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="游戏不存在")

    return {
        "success": True,
        "data": game.get_state(viewer_id=player_id)
    }

@app.post("/api/game/{game_id}/ai/add")
async def add_ai_player(game_id: str, difficulty: str = "medium"):
    """添加AI玩家"""
    result = game_manager.add_ai_player(game_id, difficulty)
    if not result:
        raise HTTPException(status_code=404, detail="游戏不存在")
    
    # 广播更新
    await game_manager.broadcast(game_id, {
        "type": "player_joined",
        "data": {"message": "AI玩家加入了游戏"}
    })
    
    return {
        "success": True,
        "data": result
    }

@app.post("/api/game/{game_id}/action")
async def player_action(game_id: str, action: PlayerAction):
    """玩家行动"""
    game = game_manager.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="游戏不存在")
    
    # 检查是否轮到该玩家
    current_player = game.players[game.current_player_index]
    if current_player.id != action.player_id:
        raise HTTPException(status_code=400, detail="不是你的回合")
    
    # 处理行动
    result = game.process_action(
        action.player_id,
        action.action_type,
        action.amount or 0
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    # 广播更新
    await game_manager.broadcast(game_id, {
        "type": "action_result",
        "data": result
    })

    await game_manager.broadcast_game_state(game_id)

    # 检查是否需要AI行动
    if not game.hand_over and game.is_ai_turn():
        game_manager.schedule_ai_turn(game_id)

    return {
        "success": True,
        "data": result
    }

@app.post("/api/game/{game_id}/start")
async def start_game(game_id: str, player_id: str = None):
    """开始游戏(传入 player_id 时返回该玩家视角状态)"""
    game = game_manager.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="游戏不存在")

    game.start_new_hand()

    await game_manager.broadcast_game_state(game_id)

    await game_manager.broadcast(game_id, {
        "type": "system_message",
        "data": {"message": "🃏 游戏开始！"}
    })

    # 检查是否轮到AI
    if not game.hand_over and game.is_ai_turn():
        game_manager.schedule_ai_turn(game_id)

    return {
        "success": True,
        "data": game.get_state(viewer_id=player_id)
    }

# ============================================
# WebSocket 连接
# ============================================

@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    """
    WebSocket 连接端点
    用于实时游戏通信
    建议通过 query param 传入 player_id(如 /ws/{game_id}?player_id=xxx),
    未提供时生成临时会话ID,用于按视角下发游戏状态
    """
    await websocket.accept()
    # 从 query param 获取 player_id,未提供则生成临时会话ID
    player_id = websocket.query_params.get("player_id") or str(uuid.uuid4())[:8]
    logger.info(f"WebSocket 连接建立: game={game_id}, player={player_id}")

    game_manager.register_connection(game_id, player_id, websocket)

    # 发送当前游戏状态(按该玩家视角,隐藏他人底牌)
    game = game_manager.get_game(game_id)
    if game:
        await websocket.send_json({
            "type": "game_state",
            "data": game.get_state(viewer_id=player_id)
        })
        await websocket.send_json({
            "type": "system_message",
            "data": {"message": "👋 欢迎来到 Poker Egg!"}
        })

    try:
        while True:
            # 接收消息
            data = await websocket.receive_text()
            message = json.loads(data)

            message_type = message.get("type")

            if message_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif message_type == "action":
                # 玩家行动
                action_data = message.get("data", {})
                action_player_id = action_data.get("player_id")
                action_type = action_data.get("action")
                amount = action_data.get("amount", 0)

                if not game:
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "游戏不存在"}
                    })
                    continue

                # 边界保护:玩家列表为空或索引越界
                if not game.players or game.current_player_index >= len(game.players):
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "游戏玩家未就绪"}
                    })
                    continue

                # 检查是否轮到该玩家
                if game.players[game.current_player_index].id != action_player_id:
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "不是你的回合"}
                    })
                    continue

                # 执行行动
                result = game.process_action(action_player_id, action_type, amount)

                if result["success"]:
                    # 广播更新
                    await game_manager.broadcast(game_id, {
                        "type": "action_result",
                        "data": result
                    })

                    await game_manager.broadcast_game_state(game_id)

                    # 检查是否需要AI行动
                    if not game.hand_over and game.is_ai_turn():
                        game_manager.schedule_ai_turn(game_id)
                else:
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": result["message"]}
                    })

            elif message_type == "chat":
                # 聊天消息
                chat_data = message.get("data", {})
                await game_manager.broadcast(game_id, {
                    "type": "chat",
                    "data": {
                        "player": chat_data.get("player_name", "Unknown"),
                        "message": chat_data.get("message", ""),
                        "timestamp": datetime.now().isoformat()
                    }
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket 断开: game={game_id}, player={player_id}")
        game_manager.unregister_connection(game_id, player_id)

    except Exception as e:
        logger.error(f"WebSocket 错误: {e}")
        game_manager.unregister_connection(game_id, player_id)

# ============================================
# 用户认证 API（后续扩展）
# ============================================

@app.post("/api/auth/register")
async def register(user_data: UserCreate):
    """用户注册"""
    # 检查用户是否存在
    existing_user = await Database.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="邮箱已被注册")
    
    # 创建用户
    try:
        user = await Database.create_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # 生成token
    token = auth_handler.create_access_token(user["id"])
    
    return {
        "success": True,
        "data": {
            "user": user,
            "token": token
        }
    }

@app.post("/api/auth/login")
async def login(request: Request):
    """用户登录（同时支持表单和 JSON 格式）"""
    # 尝试从表单读取
    username = None
    password = None
    
    try:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")
    except Exception:
        pass
    
    # 如果表单没有，尝试从 JSON 读取
    if not username or not password:
        try:
            body = await request.json()
            username = body.get("username") or username
            password = body.get("password") or password
        except Exception:
            pass
    
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名和密码不能为空",
        )
    
    user = await Database.authenticate_user(username, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = auth_handler.create_access_token(user["id"])
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/api/auth/me")
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """获取当前用户信息"""
    payload = auth_handler.decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="无效的token")
    
    user = await Database.get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    return user

# ============================================
# 统计数据 API
# ============================================

@app.get("/api/stats/{player_id}")
async def get_player_stats(player_id: str):
    """获取玩家统计数据"""
    stats = await Database.get_player_stats(player_id)
    if not stats:
        return {
            "success": True,
            "data": {
                "total_hands": 0,
                "hands_won": 0,
                "win_rate": 0,
                "total_chips_won": 0,
                "best_hand": "High Card",
                "aggression": 0.0,
                "vpip": 0.0,
                "pfr": 0.0
            }
        }
    return {
        "success": True,
        "data": stats
    }

@app.get("/api/stats/{player_id}/history")
async def get_player_history(player_id: str, limit: int = 50):
    """获取玩家历史记录"""
    history = await Database.get_player_history(player_id, limit)
    return {
        "success": True,
        "data": history
    }

# ============================================
# 陪练记录 API
# ============================================

@app.get("/api/coach/sessions")
async def list_coach_sessions(
    user_id: str = "demo_user",
    game_type: str = None,
    difficulty: str = None,
    search: str = None,
    start_time: int = None,
    end_time: int = None,
    min_win_rate: int = None,
    max_win_rate: int = None,
    min_chips: int = None,
    max_chips: int = None,
    min_hands: int = None,
    max_hands: int = None,
    mood_before: str = None,
    mood_after: str = None,
    tags: str = None,
    sort_by: str = "start_time",
    sort_order: str = "desc",
):
    """获取陪练会话列表（支持高级筛选和排序）"""
    logger.info(
        f"[CoachLogs] 查询会话列表: user={user_id}, game_type={game_type}, "
        f"difficulty={difficulty}, search={search}, sort={sort_by}/{sort_order}"
    )
    sessions = await Database.list_coach_sessions(
        user_id=user_id,
        game_type=game_type,
        difficulty=difficulty,
        search=search,
        start_time=start_time,
        end_time=end_time,
        min_win_rate=min_win_rate,
        max_win_rate=max_win_rate,
        min_chips=min_chips,
        max_chips=max_chips,
        min_hands=min_hands,
        max_hands=max_hands,
        mood_before=mood_before,
        mood_after=mood_after,
        tags=tags,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return {
        "success": True,
        "data": sessions
    }

@app.get("/api/coach/sessions/{session_id}")
async def get_coach_session(session_id: str):
    """获取单个陪练会话详情（含消息）"""
    logger.info(f"[CoachLogs] 查询会话详情: {session_id}")
    session = await Database.get_coach_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {
        "success": True,
        "data": session
    }

@app.post("/api/coach/sessions")
async def create_coach_session(request: Request):
    """创建陪练会话"""
    try:
        body = await request.json()
        logger.info(f"[CoachLogs] 创建会话: {body.get('id', 'N/A')}, game_type={body.get('game_type')}")
        result = await Database.create_coach_session(body)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        logger.error(f"[CoachLogs] 创建会话失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/coach/sessions/{session_id}")
async def delete_coach_session(session_id: str):
    """删除陪练会话"""
    logger.info(f"[CoachLogs] 删除会话: {session_id}")
    deleted = await Database.delete_coach_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {
        "success": True,
        "message": "删除成功"
    }

@app.get("/api/coach/stats")
async def get_coach_stats(
    user_id: str = "demo_user",
    game_type: str = None,
    difficulty: str = None
):
    """获取陪练统计数据"""
    logger.info(f"[CoachLogs] 查询统计: user={user_id}, game_type={game_type}, difficulty={difficulty}")
    stats = await Database.get_coach_stats(user_id, game_type, difficulty)
    return {
        "success": True,
        "data": stats
    }

# ============================================
# 人格培养方案 API
# ============================================

@app.get("/api/development/plan")
async def get_development_plan(token: str = Depends(oauth2_scheme)):
    """获取用户最新的培养方案"""
    payload = auth_handler.decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="无效的token")
    
    user_id = payload["sub"]
    logger.info(f"[DevPlan] 获取培养方案: user_id={user_id}")
    
    plan = await Database.get_development_plan(user_id)
    
    if not plan:
        # 如果没有方案，自动生成一个
        logger.info(f"[DevPlan] 无现有方案，自动生成: user_id={user_id}")
        plan_data = generate_development_plan({'mbti': 'INTJ'})
        plan = await Database.create_development_plan(user_id, plan_data)
    
    return {
        "success": True,
        "data": plan
    }

@app.post("/api/development/plan/generate")
async def generate_plan(request: DevelopmentPlanGenerate, token: str = Depends(oauth2_scheme)):
    """生成新的培养方案"""
    payload = auth_handler.decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="无效的token")
    
    user_id = payload["sub"]
    logger.info(f"[DevPlan] 生成培养方案: user_id={user_id}, mbti={request.mbti}")
    
    # 生成方案
    input_data = {
        'mbti': request.mbti,
        'decisionStyle': request.decisionStyle,
        'discipline': request.discipline,
        'timePreference': request.timePreference,
    }
    plan_data = generate_development_plan(input_data)
    
    # 保存到数据库
    plan = await Database.create_development_plan(user_id, plan_data)
    
    return {
        "success": True,
        "data": plan,
        "message": "培养方案已生成"
    }

@app.get("/api/development/plan/history")
async def get_development_plan_history(
    limit: int = 10,
    token: str = Depends(oauth2_scheme)
):
    """获取培养方案历史记录"""
    payload = auth_handler.decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="无效的token")
    
    user_id = payload["sub"]
    logger.info(f"[DevPlan] 获取方案历史: user_id={user_id}, limit={limit}")
    
    plans = await Database.list_development_plans(user_id, limit)
    
    return {
        "success": True,
        "data": plans
    }

# ============================================
# 调酒 API
# ============================================

@app.get("/api/bartender/sessions")
async def list_bartender_sessions(
    user_id: str = "demo_user",
    limit: int = 50,
    bartender: str = None
):
    """获取调酒会话列表"""
    logger.info(f"[BartenderAPI] list_sessions: user={user_id}, limit={limit}")
    sessions = await Database.list_bartender_sessions(user_id, limit, bartender)
    return {
        "success": True,
        "data": sessions
    }

@app.get("/api/bartender/sessions/{session_id}")
async def get_bartender_session(session_id: int):
    """获取单个调酒会话详情"""
    logger.info(f"[BartenderAPI] get_session: id={session_id}")
    session = await Database.get_bartender_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {
        "success": True,
        "data": session
    }

@app.post("/api/bartender/sessions")
async def create_bartender_session(request: BartenderSessionCreate):
    """创建调酒会话"""
    logger.info(f"[BartenderAPI] create_session: bartender={request.bartender}")
    try:
        session_data = request.model_dump()
        result = await Database.create_bartender_session(session_data)
        return {
            "success": True,
            "data": result,
            "message": "调酒会话已保存"
        }
    except Exception as e:
        logger.error(f"[BartenderAPI] 创建会话失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/bartender/sessions/{session_id}")
async def update_bartender_session(session_id: int, request: BartenderSessionUpdate):
    """更新调酒会话（挑战赛结果、沙盘结果、评分等）"""
    logger.info(f"[BartenderAPI] update_session: id={session_id}, fields={list(request.model_dump(exclude_none=True).keys())}")
    update_data = request.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="没有需要更新的字段")
    result = await Database.update_bartender_session(session_id, update_data)
    if not result:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {
        "success": True,
        "data": result,
        "message": "更新成功"
    }

@app.delete("/api/bartender/sessions/{session_id}")
async def delete_bartender_session(session_id: int):
    """删除调酒会话"""
    logger.info(f"[BartenderAPI] delete_session: id={session_id}")
    deleted = await Database.delete_bartender_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {
        "success": True,
        "message": "删除成功"
    }

@app.get("/api/bartender/stats")
async def get_bartender_stats(user_id: str = "demo_user"):
    """获取调酒统计数据"""
    logger.info(f"[BartenderAPI] get_stats: user={user_id}")
    stats = await Database.get_bartender_stats(user_id)
    return {
        "success": True,
        "data": stats
    }

# ============================================
# 行情 / 估值 / 十一步量化数据 API
# ============================================

@app.get("/api/market/quote")
async def api_market_quote(symbol: str):
    """
    获取单只标的实时行情
    支持代码格式：AAPL、600519、000001、sh600519、sz000001、usAAPL
    数据源：优先东方财富 push2，失败走腾讯 qt.gtimg.cn 兜底
    """
    try:
        info = normalize_symbol(symbol)
        quote = get_realtime_quote(symbol)
        return {
            "success": True,
            "data": {
                "symbol": info,
                "quote": quote,
            }
        }
    except Exception as e:
        logger.error(f"[Market] 拉取实时行情失败 symbol={symbol}: {e}")
        raise HTTPException(status_code=502, detail=f"实时行情获取失败: {e}")


@app.get("/api/market/kline")
async def api_market_kline(symbol: str, days: int = 120):
    """日 K 线（默认 120 条，前复权）"""
    try:
        bars = get_daily_kline(symbol, days=days)
        return {"success": True, "data": {"symbol": normalize_symbol(symbol), "bars": bars}}
    except Exception as e:
        logger.error(f"[Market] 拉取K线失败 symbol={symbol}: {e}")
        raise HTTPException(status_code=502, detail=f"K线获取失败: {e}")


@app.get("/api/market/valuation")
async def api_market_valuation(symbol: str):
    """
    获取标的 PRESET_ASSETS 结构 + Factors（供前端十一步量化引擎直接吃）
    返回: { symbol, quote, asset(=PRESET_ASSETS 的一行), factors }
    """
    try:
        data = get_valuation_factors(symbol)
        return {"success": True, "data": data}
    except Exception as e:
        logger.error(f"[Market] 拉取估值因子失败 symbol={symbol}: {e}")
        raise HTTPException(status_code=502, detail=f"估值因子获取失败: {e}")


@app.post("/api/market/valuation/batch")
async def api_market_valuation_batch(request: Request):
    """批量拉取多只标的的 PRESET_ASSETS + Factors（用于跑 Step0 海选池）"""
    try:
        body = await request.json()
        symbols = body.get("symbols") or []
        if not isinstance(symbols, list) or not symbols:
            raise HTTPException(status_code=400, detail="symbols 必须是非空数组")
        result_assets = []
        result_factors = {}
        quotes = {}
        errors = {}
        for sym in symbols:
            try:
                v = get_valuation_factors(sym)
                result_assets.append(v["asset"])
                result_factors[v["asset"]["ticker"]] = v["factors"]
                quotes[v["asset"]["ticker"]] = v["quote"]
            except Exception as e:  # noqa: BLE001
                errors[str(sym)] = str(e)
        return {
            "success": True,
            "data": {
                "assets": result_assets,
                "factors": result_factors,
                "quotes": quotes,
                "errors": errors,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Market] 批量拉取估值失败: {e}")
        raise HTTPException(status_code=502, detail=f"批量估值失败: {e}")

# ============================================
# 网易云音乐 API
# ============================================

@app.get("/api/music/status")
async def music_status():
    """获取音乐服务状态"""
    return {"success": True, "data": get_music_service_status()}

@app.post("/api/music/netease/login")
async def music_netease_login(request: Request):
    """网易云手机号登录"""
    try:
        data = await request.json()
        phone = data.get("phone", "")
        password = data.get("password", "")
        if not phone or not password:
            raise HTTPException(status_code=400, detail="手机号和密码不能为空")

        result = await netease_service.phone_login(phone, password)
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Music] 登录失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/music/netease/playlists")
async def music_netease_playlists(
    token: str,
    uid: int = None,
):
    """获取用户歌单"""
    try:
        result = await netease_service.get_user_playlists(token, uid)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"[Music] 获取歌单失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/music/netease/playlist/{playlist_id}")
async def music_netease_playlist_tracks(
    playlist_id: int,
    token: str = None,
):
    """获取歌单曲目"""
    try:
        result = await netease_service.get_playlist_tracks(playlist_id, token)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"[Music] 获取曲目失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/music/analyze")
async def music_analyze_profile(request: Request):
    """分析音乐画像"""
    try:
        data = await request.json()
        token = data.get("token")
        uid = data.get("uid")
        playlist_ids = data.get("playlist_ids")

        result = await analyze_music_profile(token, uid, playlist_ids)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"[Music] 分析画像失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/music/song/url")
async def music_song_url(
    id: int,
    token: str = None,
):
    """获取歌曲播放 URL"""
    try:
        result = await netease_service.get_song_url(id, token)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"[Music] 获取歌曲URL失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# 错误处理
# ============================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"未处理的异常: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "服务器内部错误"
        }
    )

# ============================================
# 启动入口
# ============================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=5000,
        reload=True,
        log_level="info"
    )

# ============================================
# LLM 通用生成路由(DeepSeek 点亮工程 · P0)
# 架构决策:一条通用代理路由 + 服务端 prompt 模板注册表
# 安全:key 服务端持有(env),不下发前端;仅注册表内模板可调,防任意 prompt 滥用
# 门控:登录态才可调用(成本可控);前端未登录走本地模板兜底,不强制全站登录
# ============================================

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

# prompt 模板注册表:服务端资产,每模板声明参数白名单 + max_tokens 成本护栏
LLM_TEMPLATES = {
    "tarot_reading": {
        "system": (
            "你是「午夜酒馆 MIDNIGHT TAVERN」的驻馆塔罗解牌师。"
            "语气:深夜酒馆般的低语,神秘而温暖,不故弄玄虚。"
            "专长:把塔罗牌意与求问者的 MBTI 人格特质交织解读。"
            "规则:1) 严格围绕给定牌面信息展开,不编造牌外含义;"
            "2) 解读分两段:第一段把牌意与人格特质交织,第二段给一句具体行动指引;"
            "3) 总字数120-180字;4) 不用emoji,不用markdown,不自称AI。"
        ),
        "user": (
            "求问者抽到的牌:「{card_name} {card_name_en}」\n"
            "牌面关键词:{keywords}\n"
            "传统牌意:{meaning}\n"
            "求问者人格:{mbti}({mbti_desc})\n"
            "请为这位求问者解牌。"
        ),
        "params": ["card_name", "card_name_en", "keywords", "meaning", "mbti", "mbti_desc"],
        "max_tokens": 420,
    },
    # ---- P1 点亮工程:各模块 AI 叙事模板 ----
    "tarot_advice": {
        "system": (
            "你是「午夜酒馆 MIDNIGHT TAVERN」的驻馆塔罗解牌师。"
            "任务:在解读之外,给求问者今日行动建议。"
            "规则:1) 输出三行:今日宜 / 今日忌 / 一件具体可执行的小事;"
            "2) 每行不超过30字;3) 建议要结合牌意与人格特质,不说空话;"
            "4) 不用emoji,不用markdown,不自称AI。"
        ),
        "user": (
            "求问者抽到的牌:「{card_name}」\n"
            "牌面关键词:{keywords}\n"
            "求问者人格:{mbti}\n"
            "请给出今日行动建议。"
        ),
        "params": ["card_name", "keywords", "mbti"],
        "max_tokens": 300,
    },
    "growth_coach": {
        "system": (
            "你是「午夜酒馆」的人格成长教练,带一点酒馆打烊前的真诚与克制。"
            "专长:根据训练阶段、薄弱维度和今日任务,给一段教练寄语。"
            "规则:1) 先点出当前阶段的本质,再戳一下最该练的弱项,最后给一个可执行的今晚动作;"
            "2) 120-180字;3) 不鸡汤,不堆砌术语,像一个真正看过你训练记录的人说话;"
            "4) 不用emoji,不用markdown,不自称AI。"
        ),
        "user": (
            "学员当前阶段:{phase_name}({phase_desc})\n"
            "薄弱维度:{weak_dims}\n"
            "今日任务:{today_tasks}\n"
            "人格底色:{mbti}\n"
            "请写下今晚的教练寄语。"
        ),
        "params": ["phase_name", "phase_desc", "weak_dims", "today_tasks", "mbti"],
        "max_tokens": 400,
    },
    "psych_brief": {
        "system": (
            "你是「午夜酒馆」的人格洞察分析师。"
            "任务:把心理测评的维度数据,转译成一段有人味的简报。"
            "规则:1) 先一句话概括人格类型本质,再点出优势组合的化学反应,最后给今日焦点一个落地场景;"
            "2) 120-180字;3) 基于给定数据说话,不编造未提供的维度;"
            "4) 不用emoji,不用markdown,不自称AI。"
        ),
        "user": (
            "人格类型:{persona_type}\n"
            "优势维度:{strengths}\n"
            "今日焦点:{today_focus}\n"
            "维度概览:{dims_summary}\n"
            "请生成本期人格简报。"
        ),
        "params": ["persona_type", "strengths", "today_focus", "dims_summary"],
        "max_tokens": 400,
    },
    "dispatch_reason": {
        "system": (
            "你是「午夜酒馆」的调度指挥中心 AI 播报员。"
            "任务:把无人机调度决策的信号数据,翻译成一段调度员会说的自然语言理由。"
            "规则:1) 先说结论(为什么派/为什么不派),再讲主导因子的权衡,最后给一句风险提示;"
            "2) 100-160字;3) 忠实于给定信号,不虚构数据;"
            "4) 不用emoji,不用markdown,不自称AI。"
        ),
        "user": (
            "调度建议:{recommendation}\n"
            "决策得分:{score},执行概率:{probability}\n"
            "主导因子:{primary_factor}\n"
            "引擎解释:{explanation}\n"
            "请播报本次调度理由。"
        ),
        "params": ["recommendation", "score", "probability", "primary_factor", "explanation"],
        "max_tokens": 350,
    },
    "robot_dialogue": {
        "system": (
            "你是「午夜酒馆」的陪伴机器人,会根据客人的人格调整说话方式。"
            "任务:在给定模式下,对客人的话给一段符合其人格语气的回应示例。"
            "规则:1) 严格使用指定语气;2) 回应2-4句,像真实对话不像客服;"
            "3) 不越界给医疗/金融建议;4) 不用emoji,不用markdown,不自称AI。"
        ),
        "user": (
            "对话模式:{mode_name}\n"
            "客人人格:{mbti}\n"
            "应采用语气:{tone}\n"
            "场景:{scenario}\n"
            "请给出回应示例。"
        ),
        "params": ["mode_name", "mbti", "tone", "scenario"],
        "max_tokens": 350,
    },
    "party_report": {
        "system": (
            "你是「午夜酒馆」的酒局主理人,刚送走一位客人。"
            "任务:为这场企业家酒局写一段回顾叙事,把选酒、饮法、雪茄与对话选择,读成这个人的人格侧写。"
            "规则:1) 以主理人视角第二人称叙述;2) 150-200字;"
            "3) 点出匹配的企业家原型及原因,最后留一句下次来酒馆该试什么的钩子;"
            "4) 不用emoji,不用markdown,不自称AI。"
        ),
        "user": (
            "客人选酒:{spirit_name}\n"
            "匹配原型:{persona_name}(匹配度 {match_percent})\n"
            "酒局角色:{role_name}\n"
            "对话风格:{dialogue_style}\n"
            "议题:{topic_question}\n"
            "客人回应:{user_response}\n"
            "请写下这场酒局的回顾。"
        ),
        "params": ["spirit_name", "persona_name", "match_percent", "role_name", "dialogue_style", "topic_question", "user_response"],
        "max_tokens": 450,
    },
    "investor_report": {
        "system": (
            "你是「午夜酒馆」的人格金融分析师。"
            "任务:解读用户行为数据与名人投资人的匹配结果,给出选择建议。"
            "规则:1) 先讲契合点意味着什么优势,再讲差异点藏着什么风险,最后给一条具体的选择建议(适合什么策略/避开什么策略);"
            "2) 150-200字;3) 忠实于给定匹配数据,不虚构数字;"
            "4) 不用emoji,不用markdown,不自称AI。"
        ),
        "user": (
            "匹配投资人:{investor_name}({investor_title})\n"
            "相似度:{similarity}({tier_label})\n"
            "契合点:{common_points}\n"
            "差异点:{difference_points}\n"
            "引擎建议:{advice}\n"
            "请生成本次匹配解读与选择建议。"
        ),
        "params": ["investor_name", "investor_title", "similarity", "tier_label", "common_points", "difference_points", "advice"],
        "max_tokens": 450,
    },
    "master_report": {
        "system": (
            "你是「午夜酒馆」人格金融孪生空间的总分析师。"
            "任务:综合客人各模块留下的人格痕迹(塔罗、酒局、投资人匹配、成长阶段),写一份综合报告并给出一个选择建议。"
            "规则:1) 结构:先一句话给这个人格下判断,再串起各模块证据的内在一致性或矛盾点,最后给一条明确的选择建议;"
            "2) 200-260字;3) 只使用给定证据,缺失的模块不编;"
            "4) 不用emoji,不用markdown,不自称AI。"
        ),
        "user": (
            "人格底色:{mbti}\n"
            "塔罗指引:{tarot_card}\n"
            "酒局原型:{party_persona}\n"
            "投资人匹配:{investor_name}(相似度 {similarity})\n"
            "成长阶段:{phase_name}\n"
            "薄弱维度:{weak_dims}\n"
            "请生成综合报告与选择建议。"
        ),
        "params": ["mbti", "tarot_card", "party_persona", "investor_name", "similarity", "phase_name", "weak_dims"],
        "max_tokens": 550,
    },
}


class LLMGenerateRequest(BaseModel):
    template: str
    params: Dict[str, Any] = {}


@app.post("/api/llm/generate")
async def llm_generate(req: LLMGenerateRequest, token: str = Depends(oauth2_scheme)):
    """通用 LLM 生成代理(登录门控 + 模板注册表)"""
    payload = auth_handler.decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="登录已过期,请重新登录")

    if not DEEPSEEK_API_KEY:
        raise HTTPException(status_code=503, detail="LLM 服务未配置")

    tpl = LLM_TEMPLATES.get(req.template)
    if not tpl:
        raise HTTPException(status_code=400, detail=f"未知模板: {req.template}")

    # 参数白名单 + 长度护栏(每个参数最多 200 字符)
    safe_params = {k: str(req.params.get(k, ""))[:200] for k in tpl["params"]}
    try:
        user_prompt = tpl["user"].format(**safe_params)
    except (KeyError, IndexError):
        raise HTTPException(status_code=400, detail="模板参数不完整")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{DEEPSEEK_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}"},
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": tpl["system"]},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_tokens": tpl["max_tokens"],
                    "temperature": 0.8,
                },
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"LLM 上游错误: {resp.status_code}")
        data = resp.json()
        text = data["choices"][0]["message"]["content"].strip()
        usage = data.get("usage", {})
        return {
            "success": True,
            "data": {
                "template": req.template,
                "text": text,
                "usage": usage,
            },
        }
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="LLM 响应超时,请重试")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {str(e)[:100]}")


@app.get("/api/llm/templates")
async def llm_templates():
    """列出可用 LLM 模板(公开,便于前端探测能力)"""
    return {
        "success": True,
        "data": {
            "templates": [
                {"name": k, "params": v["params"], "max_tokens": v["max_tokens"]}
                for k, v in LLM_TEMPLATES.items()
            ],
            "configured": bool(DEEPSEEK_API_KEY),
        },
    }

