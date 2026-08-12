"""
Pydantic 数据模型
用于请求/响应验证
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class UserCreate(BaseModel):
    """用户注册"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    """用户登录"""
    username: str
    password: str


class Token(BaseModel):
    """Token响应"""
    access_token: str
    token_type: str = "bearer"
    user: Optional[Dict] = None


class GameCreate(BaseModel):
    """创建游戏"""
    player_name: Optional[str] = "Player"
    ai_difficulty: Optional[str] = "medium"


class GameJoin(BaseModel):
    """加入游戏"""
    player_name: Optional[str] = "Player"


class PlayerAction(BaseModel):
    """玩家行动"""
    player_id: str
    action_type: str = Field(..., pattern="^(fold|check|call|raise|allin)$")
    amount: Optional[int] = 0


class GameState(BaseModel):
    """游戏状态"""
    id: str
    players: List[Dict]
    board: List[Dict]
    pot: int
    stage: str
    hand_over: bool
    winner: Optional[Dict]
    current_player: int
    history: List[Dict]


class PlayerStats(BaseModel):
    """玩家统计"""
    player_id: str
    total_hands: int
    hands_won: int
    win_rate: float
    total_chips_won: int
    best_hand: str
    aggression: float


class WebSocketMessage(BaseModel):
    """WebSocket消息"""
    type: str
    data: Optional[Dict] = None


class DevelopmentPlanGenerate(BaseModel):
    """培养方案生成请求"""
    mbti: Optional[str] = None
    decisionStyle: Optional[str] = None
    discipline: Optional[str] = None
    timePreference: Optional[str] = None


class DevelopmentPlanResponse(BaseModel):
    """培养方案响应"""
    id: Optional[int] = None
    user_id: str
    mbti: str
    status: Dict[str, Any]
    modules: Dict[str, Any]
    generated_at: int
    created_at: Optional[Any] = None


# ============================================
# 调酒相关模型
# ============================================

class CocktailIngredient(BaseModel):
    """鸡尾酒成分"""
    name: str
    amount: Optional[str] = None
    unit: Optional[str] = None


class CocktailData(BaseModel):
    """鸡尾酒配方数据"""
    name: str
    flavor: str
    texture: str
    temperature: str
    presentation: str
    ingredients: List[str]
    recipeSource: Optional[str] = "molecular"
    story: Optional[str] = None
    color: Optional[str] = None


class BartenderSessionCreate(BaseModel):
    """创建调酒会话"""
    user_id: Optional[str] = "demo_user"
    bartender: str
    bartenderName: Optional[str] = None
    emotion: Optional[str] = None
    baseSpirit: Optional[str] = None
    storySeed: Optional[str] = None
    specialNote: Optional[str] = None
    zodiacCorrect: Optional[bool] = False
    cocktail: CocktailData
    challengeResult: Optional[Dict[str, Any]] = None
    sandboxResult: Optional[Dict[str, Any]] = None


class BartenderSessionUpdate(BaseModel):
    """更新调酒会话"""
    challengeResult: Optional[Dict[str, Any]] = None
    sandboxResult: Optional[Dict[str, Any]] = None
    rating: Optional[int] = None
    note: Optional[str] = None


class BartenderSessionResponse(BaseModel):
    """调酒会话响应"""
    id: int
    user_id: str
    bartender: str
    bartenderName: Optional[str] = None
    emotion: Optional[str] = None
    baseSpirit: Optional[str] = None
    storySeed: Optional[str] = None
    cocktail: Dict[str, Any]
    challengeResult: Optional[Dict[str, Any]] = None
    sandboxResult: Optional[Dict[str, Any]] = None
    zodiacCorrect: Optional[bool] = False
    rating: Optional[int] = None
    note: Optional[str] = None
    created_at: Any
    timestamp: Optional[int] = None


class BartenderStatsResponse(BaseModel):
    """调酒统计响应"""
    total_sessions: int
    bartender_count: Dict[str, int]
    emotion_count: Dict[str, int]
    base_spirit_count: Dict[str, int]
    avg_challenge_score: float
    mbti_distribution: Dict[str, int]
    recent_sessions: List[Dict[str, Any]]
