"""
数据库连接和操作
使用 PostgreSQL + asyncpg
"""
import asyncpg
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import os
import logging
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()

logger = logging.getLogger(__name__)

# 密码哈希上下文(bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Database:
    """数据库管理类"""

    _pool: asyncpg.Pool = None
    # 内存模式存储（PostgreSQL 不可用时使用）
    _memory_users: Dict[str, Dict] = {}  # username -> user dict(含 password_hash)
    _memory_coach_sessions: Dict[str, Dict] = {}
    _memory_coach_messages: Dict[str, List[Dict]] = {}
    _memory_development_plans: Dict[str, List[Dict]] = {}  # user_id -> [plans]
    _memory_bartender_sessions: Dict[str, Dict] = {}  # id -> session
    
    @classmethod
    async def connect(cls):
        """连接数据库"""
        if cls._pool:
            return
        
        database_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/poker_egg")
        
        try:
            cls._pool = await asyncpg.create_pool(
                database_url,
                min_size=5,
                max_size=20
            )
            
            # 创建表
            await cls._create_tables()
            
        except Exception as e:
            print(f"数据库连接失败: {e}")
            # 如果连接失败，使用内存存储（开发模式）
            cls._pool = None
    
    @classmethod
    async def disconnect(cls):
        """断开数据库连接"""
        if cls._pool:
            await cls._pool.close()
            cls._pool = None
    
    @classmethod
    async def _create_tables(cls):
        """创建数据表"""
        if not cls._pool:
            return
        
        async with cls._pool.acquire() as conn:
            # 用户表
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(36) PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    chips INTEGER DEFAULT 1000,
                    total_hands INTEGER DEFAULT 0,
                    hands_won INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 游戏历史表
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS game_history (
                    id SERIAL PRIMARY KEY,
                    game_id VARCHAR(36) NOT NULL,
                    player_id VARCHAR(36) NOT NULL,
                    hand_data JSONB NOT NULL,
                    result VARCHAR(20),
                    chips_change INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # AI训练数据表
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS ai_training_data (
                    id SERIAL PRIMARY KEY,
                    game_id VARCHAR(36) NOT NULL,
                    state_data JSONB NOT NULL,
                    action_taken VARCHAR(20),
                    result VARCHAR(20),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 陪练会话表
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS coach_sessions (
                    id VARCHAR(64) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    game_type VARCHAR(20) NOT NULL,
                    game_type_label VARCHAR(50),
                    game_type_icon VARCHAR(10),
                    ai_difficulty VARCHAR(10) DEFAULT 'medium',
                    start_time BIGINT NOT NULL,
                    end_time BIGINT,
                    total_hands INTEGER DEFAULT 0,
                    hands_won INTEGER DEFAULT 0,
                    win_rate INTEGER DEFAULT 0,
                    chips_change INTEGER DEFAULT 0,
                    coach_summary TEXT,
                    mood_before VARCHAR(20),
                    mood_after VARCHAR(20),
                    tags JSONB DEFAULT '[]'::jsonb,
                    created_at BIGINT NOT NULL
                )
            """)
            
            # 陪练消息表
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS coach_messages (
                    id VARCHAR(64) PRIMARY KEY,
                    session_id VARCHAR(64) NOT NULL REFERENCES coach_sessions(id) ON DELETE CASCADE,
                    role VARCHAR(10) NOT NULL,
                    message_type VARCHAR(20) NOT NULL,
                    content TEXT NOT NULL,
                    hand_id VARCHAR(64),
                    metadata JSONB,
                    created_at BIGINT NOT NULL
                )
            """)
            
            # 人格培养方案表
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS development_plans (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    mbti VARCHAR(8) NOT NULL,
                    status JSONB NOT NULL DEFAULT '{}'::jsonb,
                    modules JSONB NOT NULL DEFAULT '{}'::jsonb,
                    generated_at BIGINT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 调酒会话表
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS bartender_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    bartender VARCHAR(20) NOT NULL,
                    bartender_name VARCHAR(50),
                    emotion VARCHAR(30),
                    base_spirit VARCHAR(30),
                    story_seed VARCHAR(50),
                    special_note TEXT,
                    zodiac_correct BOOLEAN DEFAULT FALSE,
                    cocktail JSONB NOT NULL,
                    challenge_result JSONB,
                    sandbox_result JSONB,
                    rating INTEGER,
                    note TEXT,
                    created_at BIGINT NOT NULL,
                    timestamp BIGINT
                )
            """)
            
            # 创建索引
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_game_history_player ON game_history(player_id);
                CREATE INDEX IF NOT EXISTS idx_game_history_game ON game_history(game_id);
                CREATE INDEX IF NOT EXISTS idx_ai_training_game ON ai_training_data(game_id);
                CREATE INDEX IF NOT EXISTS idx_coach_sessions_user ON coach_sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_coach_sessions_game ON coach_sessions(game_type);
                CREATE INDEX IF NOT EXISTS idx_coach_messages_session ON coach_messages(session_id);
                CREATE INDEX IF NOT EXISTS idx_development_plans_user ON development_plans(user_id);
                CREATE INDEX IF NOT EXISTS idx_bartender_sessions_user ON bartender_sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_bartender_sessions_bartender ON bartender_sessions(bartender);
            """)
    
    @classmethod
    async def get_user_by_email(cls, email: str) -> Optional[Dict]:
        """根据邮箱获取用户"""
        if not cls._pool:
            return None
        
        async with cls._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE email = $1",
                email
            )
            return dict(row) if row else None
    
    @classmethod
    async def get_user_by_id(cls, user_id: str) -> Optional[Dict]:
        """根据ID获取用户"""
        if not cls._pool:
            return None
        
        async with cls._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE id = $1",
                user_id
            )
            return dict(row) if row else None
    
    @classmethod
    async def create_user(cls, username: str, email: str, password: str) -> Dict:
        """创建用户(密码自动哈希存储,返回结果不含密码哈希)"""
        password_hash = pwd_context.hash(password)

        if not cls._pool:
            # 内存模式:保存密码哈希以支持登录验证
            if username in cls._memory_users:
                raise ValueError("用户名已存在")
            user_id = str(uuid.uuid4())[:8]
            user = {
                "id": user_id,
                "username": username,
                "email": email,
                "password_hash": password_hash,
                "chips": 1000,
                "total_hands": 0,
                "hands_won": 0
            }
            cls._memory_users[username] = user
            safe = dict(user)
            safe.pop("password_hash", None)
            return safe

        user_id = str(uuid.uuid4())[:8]

        async with cls._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO users (id, username, email, password_hash, chips)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
                """,
                user_id, username, email, password_hash, 1000
            )
            user = dict(row) if row else None
            if user and "password_hash" in user:
                user.pop("password_hash", None)
            return user
    
    @classmethod
    async def authenticate_user(cls, username: str, password: str) -> Optional[Dict]:
        """验证用户名和密码"""
        if not cls._pool:
            # 内存模式:校验已注册用户的密码哈希
            user = cls._memory_users.get(username)
            if not user:
                return None
            if not pwd_context.verify(password, user.get("password_hash", "")):
                return None
            safe = dict(user)
            safe.pop("password_hash", None)
            return safe

        async with cls._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE username = $1",
                username
            )
            if not row:
                return None
            user = dict(row)
            # 校验密码哈希
            if not pwd_context.verify(password, user.get("password_hash", "")):
                return None
            user.pop("password_hash", None)
            return user
    
    @classmethod
    async def save_game_history(cls, game_id: str, player_id: str, hand_data: Dict, result: str, chips_change: int):
        """保存游戏历史"""
        if not cls._pool:
            return
        
        async with cls._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO game_history (game_id, player_id, hand_data, result, chips_change)
                VALUES ($1, $2, $3, $4, $5)
                """,
                game_id, player_id, json.dumps(hand_data), result, chips_change
            )
    
    @classmethod
    async def get_player_stats(cls, player_id: str) -> Optional[Dict]:
        """获取玩家统计数据"""
        if not cls._pool:
            return None
        
        async with cls._pool.acquire() as conn:
            # 从用户表获取基本信息
            user = await conn.fetchrow(
                "SELECT chips, total_hands, hands_won FROM users WHERE id = $1",
                player_id
            )
            
            if not user:
                return None
            
            # 从历史记录获取更多统计
            history = await conn.fetch(
                """
                SELECT 
                    COUNT(*) as total_hands,
                    SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
                    SUM(chips_change) as total_chips_won
                FROM game_history
                WHERE player_id = $1
                """,
                player_id
            )
            
            total = history[0] if history else None
            
            return {
                "chips": user["chips"],
                "total_hands": user["total_hands"],
                "hands_won": user["hands_won"],
                "win_rate": user["hands_won"] / user["total_hands"] if user["total_hands"] > 0 else 0,
                "total_chips_won": total["total_chips_won"] if total else 0
            }
    
    @classmethod
    async def get_player_history(cls, player_id: str, limit: int = 50) -> List[Dict]:
        """获取玩家历史记录"""
        if not cls._pool:
            return []
        
        async with cls._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT game_id, hand_data, result, chips_change, created_at
                FROM game_history
                WHERE player_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                player_id, limit
            )
            return [dict(row) for row in rows]

    # ============================================================
    # 陪练记录相关方法
    # ============================================================

    @classmethod
    async def list_coach_sessions(cls, user_id: str, game_type: str = None,
                                    difficulty: str = None, search: str = None,
                                    start_time: int = None, end_time: int = None,
                                    min_win_rate: int = None, max_win_rate: int = None,
                                    min_chips: int = None, max_chips: int = None,
                                    min_hands: int = None, max_hands: int = None,
                                    mood_before: str = None, mood_after: str = None,
                                    tags: str = None,
                                    sort_by: str = 'start_time', sort_order: str = 'desc') -> List[Dict]:
        """获取陪练会话列表（支持高级筛选和排序）"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        filter_summary = {
            'user_id': user_id, 'game_type': game_type, 'difficulty': difficulty,
            'search': search, 'start_time': start_time, 'end_time': end_time,
            'min_win_rate': min_win_rate, 'max_win_rate': max_win_rate,
            'min_chips': min_chips, 'max_chips': max_chips,
            'min_hands': min_hands, 'max_hands': max_hands,
            'mood_before': mood_before, 'mood_after': mood_after,
            'tags': tags, 'sort_by': sort_by, 'sort_order': sort_order,
        }
        logger.info(f"[CoachLogs][list] → 开始查询, mode={mode}, filters={filter_summary}")
        try:
            if not cls._pool:
                # 内存模式
                sessions = list(cls._memory_coach_sessions.values())
                total = len(sessions)
                sessions = [s for s in sessions if s.get('user_id') == user_id]
                after_user = len(sessions)

                if game_type and game_type != 'all':
                    sessions = [s for s in sessions if s.get('game_type') == game_type]
                if difficulty and difficulty != 'all':
                    sessions = [s for s in sessions if s.get('ai_difficulty') == difficulty]
                if search:
                    q = search.lower()
                    sessions = [s for s in sessions if
                        (s.get('coach_summary') and q in s['coach_summary'].lower()) or
                        (s.get('tags') and any(q in t.lower() for t in s['tags']))
                    ]
                if start_time:
                    sessions = [s for s in sessions if s.get('start_time', 0) >= start_time]
                if end_time:
                    sessions = [s for s in sessions if s.get('start_time', 0) <= end_time]
                if min_win_rate is not None:
                    sessions = [s for s in sessions if s.get('win_rate', 0) >= min_win_rate]
                if max_win_rate is not None:
                    sessions = [s for s in sessions if s.get('win_rate', 0) <= max_win_rate]
                if min_chips is not None:
                    sessions = [s for s in sessions if s.get('chips_change', 0) >= min_chips]
                if max_chips is not None:
                    sessions = [s for s in sessions if s.get('chips_change', 0) <= max_chips]
                if min_hands is not None:
                    sessions = [s for s in sessions if s.get('total_hands', 0) >= min_hands]
                if max_hands is not None:
                    sessions = [s for s in sessions if s.get('total_hands', 0) <= max_hands]
                if mood_before:
                    moods = mood_before.split(',')
                    sessions = [s for s in sessions if s.get('mood_before') in moods]
                if mood_after:
                    moods = mood_after.split(',')
                    sessions = [s for s in sessions if s.get('mood_after') in moods]
                if tags:
                    tag_list = tags.split(',')
                    sessions = [s for s in sessions if
                        s.get('tags') and any(t in s['tags'] for t in tag_list)
                    ]

                # 排序
                reverse = sort_order == 'desc'
                sort_key_map = {
                    'start_time': 'start_time',
                    'win_rate': 'win_rate',
                    'chips_change': 'chips_change',
                    'total_hands': 'total_hands',
                }
                sort_field = sort_key_map.get(sort_by, 'start_time')
                sessions.sort(key=lambda s: s.get(sort_field, 0), reverse=reverse)

                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[CoachLogs][list] ✓ 查询完成, mode={mode}, "
                    f"结果={len(sessions)}条 (全库{total}, 用户过滤后{after_user}), 排序={sort_by}/{sort_order}, 耗时{elapsed:.1f}ms"
                )
                return sessions

            query = "SELECT * FROM coach_sessions WHERE user_id = $1"
            params = [user_id]
            param_idx = 2

            if game_type and game_type != 'all':
                query += f" AND game_type = ${param_idx}"
                params.append(game_type)
                param_idx += 1
            if difficulty and difficulty != 'all':
                query += f" AND ai_difficulty = ${param_idx}"
                params.append(difficulty)
                param_idx += 1
            if search:
                query += f" AND (coach_summary ILIKE ${param_idx} OR tags::text ILIKE ${param_idx})"
                params.append(f"%{search}%")
                param_idx += 1
            if start_time:
                query += f" AND start_time >= ${param_idx}"
                params.append(start_time)
                param_idx += 1
            if end_time:
                query += f" AND start_time <= ${param_idx}"
                params.append(end_time)
                param_idx += 1
            if min_win_rate is not None:
                query += f" AND win_rate >= ${param_idx}"
                params.append(min_win_rate)
                param_idx += 1
            if max_win_rate is not None:
                query += f" AND win_rate <= ${param_idx}"
                params.append(max_win_rate)
                param_idx += 1
            if min_chips is not None:
                query += f" AND chips_change >= ${param_idx}"
                params.append(min_chips)
                param_idx += 1
            if max_chips is not None:
                query += f" AND chips_change <= ${param_idx}"
                params.append(max_chips)
                param_idx += 1
            if min_hands is not None:
                query += f" AND total_hands >= ${param_idx}"
                params.append(min_hands)
                param_idx += 1
            if max_hands is not None:
                query += f" AND total_hands <= ${param_idx}"
                params.append(max_hands)
                param_idx += 1
            if mood_before:
                moods = mood_before.split(',')
                placeholders = ','.join([f"${param_idx + i}" for i in range(len(moods))])
                query += f" AND mood_before IN ({placeholders})"
                params.extend(moods)
                param_idx += len(moods)
            if mood_after:
                moods = mood_after.split(',')
                placeholders = ','.join([f"${param_idx + i}" for i in range(len(moods))])
                query += f" AND mood_after IN ({placeholders})"
                params.extend(moods)
                param_idx += len(moods)
            if tags:
                tag_list = tags.split(',')
                for t in tag_list:
                    query += f" AND tags::text ILIKE ${param_idx}"
                    params.append(f"%{t}%")
                    param_idx += 1

            # 排序
            sort_field_map = {
                'start_time': 'start_time',
                'win_rate': 'win_rate',
                'chips_change': 'chips_change',
                'total_hands': 'total_hands',
            }
            order_field = sort_field_map.get(sort_by, 'start_time')
            order_dir = 'DESC' if sort_order == 'desc' else 'ASC'
            query += f" ORDER BY {order_field} {order_dir}"

            logger.debug(f"[CoachLogs][list] SQL: {query}, params: {params}")

            async with cls._pool.acquire() as conn:
                rows = await conn.fetch(query, *params)
                sessions = [dict(row) for row in rows]
                # 解析 JSON 字段
                for s in sessions:
                    if isinstance(s.get('tags'), str):
                        s['tags'] = json.loads(s['tags'])
                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[CoachLogs][list] ✓ 查询完成, mode={mode}, "
                    f"结果={len(sessions)}条, 耗时{elapsed:.1f}ms"
                )
                return sessions
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(
                f"[CoachLogs][list] ✗ 查询异常, mode={mode}, 耗时{elapsed:.1f}ms, "
                f"错误: {str(e)}"
            )
            raise

    @classmethod
    async def get_coach_session(cls, session_id: str) -> Optional[Dict]:
        """获取单个陪练会话详情（含消息）"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        logger.info(f"[CoachLogs][get] → 查询会话详情, mode={mode}, session_id={session_id}")
        try:
            if not cls._pool:
                # 内存模式
                session = cls._memory_coach_sessions.get(session_id)
                if not session:
                    elapsed = (time.time() - start) * 1000
                    logger.warning(f"[CoachLogs][get] ✗ 会话不存在, mode={mode}, session_id={session_id}, 耗时{elapsed:.1f}ms")
                    return None
                session = dict(session)
                messages = cls._memory_coach_messages.get(session_id, [])
                session['messages'] = messages
                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[CoachLogs][get] ✓ 查询完成, mode={mode}, session_id={session_id}, "
                    f"消息数={len(messages)}, 耗时{elapsed:.1f}ms"
                )
                return session

            async with cls._pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM coach_sessions WHERE id = $1",
                    session_id
                )
                if not row:
                    elapsed = (time.time() - start) * 1000
                    logger.warning(f"[CoachLogs][get] ✗ 会话不存在, mode={mode}, session_id={session_id}, 耗时{elapsed:.1f}ms")
                    return None

                session = dict(row)
                if isinstance(session.get('tags'), str):
                    session['tags'] = json.loads(session['tags'])

                # 获取关联消息
                msg_rows = await conn.fetch(
                    "SELECT * FROM coach_messages WHERE session_id = $1 ORDER BY created_at ASC",
                    session_id
                )
                messages = [dict(m) for m in msg_rows]
                for m in messages:
                    if isinstance(m.get('metadata'), str):
                        m['metadata'] = json.loads(m['metadata'])

                session['messages'] = messages
                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[CoachLogs][get] ✓ 查询完成, mode={mode}, session_id={session_id}, "
                    f"消息数={len(messages)}, 耗时{elapsed:.1f}ms"
                )
                return session
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(
                f"[CoachLogs][get] ✗ 查询异常, mode={mode}, session_id={session_id}, "
                f"耗时{elapsed:.1f}ms, 错误: {str(e)}"
            )
            raise

    @classmethod
    async def create_coach_session(cls, session_data: Dict) -> Dict:
        """创建陪练会话"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        # 缺失 id 时自动生成,避免 'N/A' 导致会话互相覆盖
        sid = session_data.get('id')
        if not sid:
            sid = str(uuid.uuid4())[:8]
            session_data['id'] = sid
        msg_count = len(session_data.get('messages', []))
        logger.info(
            f"[CoachLogs][create] → 创建会话, mode={mode}, id={sid}, "
            f"game_type={session_data.get('game_type')}, messages={msg_count}"
        )
        try:
            if not cls._pool:
                # 内存模式
                cls._memory_coach_sessions[sid] = session_data
                messages = session_data.get('messages', [])
                cls._memory_coach_messages[sid] = messages
                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[CoachLogs][create] ✓ 创建完成, mode={mode}, id={sid}, "
                    f"消息数={len(messages)}, 耗时{elapsed:.1f}ms"
                )
                return session_data

            async with cls._pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO coach_sessions (
                        id, user_id, game_type, game_type_label, game_type_icon,
                        ai_difficulty, start_time, end_time, total_hands,
                        hands_won, win_rate, chips_change, coach_summary,
                        mood_before, mood_after, tags, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                    """,
                    session_data['id'],
                    session_data.get('user_id', 'demo_user'),
                    session_data['game_type'],
                    session_data.get('game_type_label'),
                    session_data.get('game_type_icon'),
                    session_data.get('ai_difficulty', 'medium'),
                    session_data['start_time'],
                    session_data.get('end_time'),
                    session_data.get('total_hands', 0),
                    session_data.get('hands_won', 0),
                    session_data.get('win_rate', 0),
                    session_data.get('chips_change', 0),
                    session_data.get('coach_summary'),
                    session_data.get('mood_before'),
                    session_data.get('mood_after'),
                    json.dumps(session_data.get('tags', [])),
                    session_data.get('created_at', session_data['start_time'])
                )

                # 批量插入消息
                messages = session_data.get('messages', [])
                for msg in messages:
                    await conn.execute(
                        """
                        INSERT INTO coach_messages (
                            id, session_id, role, message_type, content,
                            hand_id, metadata, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        """,
                        msg['id'],
                        msg['session_id'],
                        msg['role'],
                        msg['message_type'],
                        msg['content'],
                        msg.get('hand_id'),
                        json.dumps(msg.get('metadata')) if msg.get('metadata') else None,
                        msg['created_at']
                    )

                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[CoachLogs][create] ✓ 创建完成, mode={mode}, id={sid}, "
                    f"消息数={len(messages)}, 耗时{elapsed:.1f}ms"
                )
                return session_data
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(
                f"[CoachLogs][create] ✗ 创建异常, mode={mode}, id={sid}, "
                f"耗时{elapsed:.1f}ms, 错误: {str(e)}"
            )
            raise

    @classmethod
    async def delete_coach_session(cls, session_id: str) -> bool:
        """删除陪练会话（级联删除消息）"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        logger.info(f"[CoachLogs][delete] → 删除会话, mode={mode}, session_id={session_id}")
        try:
            if not cls._pool:
                # 内存模式
                if session_id in cls._memory_coach_sessions:
                    del cls._memory_coach_sessions[session_id]
                    cls._memory_coach_messages.pop(session_id, None)
                    elapsed = (time.time() - start) * 1000
                    logger.info(
                        f"[CoachLogs][delete] ✓ 删除成功, mode={mode}, session_id={session_id}, 耗时{elapsed:.1f}ms"
                    )
                    return True
                elapsed = (time.time() - start) * 1000
                logger.warning(
                    f"[CoachLogs][delete] ✗ 会话不存在, mode={mode}, session_id={session_id}, 耗时{elapsed:.1f}ms"
                )
                return False

            async with cls._pool.acquire() as conn:
                result = await conn.execute(
                    "DELETE FROM coach_sessions WHERE id = $1",
                    session_id
                )
                deleted = 'DELETE 1' in result
                elapsed = (time.time() - start) * 1000
                if deleted:
                    logger.info(
                        f"[CoachLogs][delete] ✓ 删除成功, mode={mode}, session_id={session_id}, 耗时{elapsed:.1f}ms"
                    )
                else:
                    logger.warning(
                        f"[CoachLogs][delete] ✗ 会话不存在, mode={mode}, session_id={session_id}, 耗时{elapsed:.1f}ms"
                    )
                return deleted
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(
                f"[CoachLogs][delete] ✗ 删除异常, mode={mode}, session_id={session_id}, "
                f"耗时{elapsed:.1f}ms, 错误: {str(e)}"
            )
            raise

    @classmethod
    async def get_coach_stats(cls, user_id: str, game_type: str = None,
                               difficulty: str = None) -> Dict:
        """获取陪练统计数据"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        logger.info(
            f"[CoachLogs][stats] → 计算统计, mode={mode}, "
            f"user_id={user_id}, game_type={game_type}, difficulty={difficulty}"
        )
        try:
            if not cls._pool:
                # 内存模式:数据量小,直接聚合
                sessions = await cls.list_coach_sessions(user_id, game_type, difficulty)

                if not sessions:
                    elapsed = (time.time() - start) * 1000
                    logger.info(
                        f"[CoachLogs][stats] ✓ 无数据, mode={mode}, sessions=0, 耗时{elapsed:.1f}ms"
                    )
                    return {
                        'total_sessions': 0,
                        'total_hands': 0,
                        'avg_win_rate': 0,
                        'total_chips': 0,
                        'avg_session_duration': 0,
                        'by_game_type': {},
                        'mood_distribution': {},
                    }

                total_hands = sum(s.get('total_hands', 0) for s in sessions)
                total_wins = sum(s.get('hands_won', 0) for s in sessions)
                total_chips = sum(s.get('chips_change', 0) for s in sessions)

                by_game_type = {}
                mood_dist = {}
                for s in sessions:
                    label = s.get('game_type_label') or s.get('game_type', '未知')
                    by_game_type[label] = by_game_type.get(label, 0) + 1
                    mood = s.get('mood_after', 'unknown')
                    mood_dist[mood] = mood_dist.get(mood, 0) + 1

                avg_duration = 0
                durations = [(s.get('end_time') or 0) - (s.get('start_time') or 0) for s in sessions if s.get('end_time')]
                if durations:
                    avg_duration = round(sum(durations) / len(durations) / 60000)

                stats = {
                    'total_sessions': len(sessions),
                    'total_hands': total_hands,
                    'avg_win_rate': round((total_wins / total_hands) * 100) if total_hands > 0 else 0,
                    'total_chips': total_chips,
                    'avg_session_duration': avg_duration,
                    'by_game_type': by_game_type,
                    'mood_distribution': mood_dist,
                }
                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[CoachLogs][stats] ✓ 统计完成, mode={mode}, sessions={stats['total_sessions']}, "
                    f"hands={total_hands}, win_rate={stats['avg_win_rate']}%, chips={total_chips}, 耗时{elapsed:.1f}ms"
                )
                return stats

            # PostgreSQL 模式:用 SQL 聚合,避免加载全部会话到内存
            where = ["user_id = $1"]
            params = [user_id]
            idx = 2
            if game_type and game_type != 'all':
                where.append(f"game_type = ${idx}")
                params.append(game_type)
                idx += 1
            if difficulty and difficulty != 'all':
                where.append(f"ai_difficulty = ${idx}")
                params.append(difficulty)
                idx += 1
            where_clause = " AND ".join(where)

            async with cls._pool.acquire() as conn:
                total_row = await conn.fetchrow(f"""
                    SELECT
                        COUNT(*) as total_sessions,
                        COALESCE(SUM(total_hands), 0) as total_hands,
                        COALESCE(SUM(hands_won), 0) as total_wins,
                        COALESCE(SUM(chips_change), 0) as total_chips
                    FROM coach_sessions
                    WHERE {where_clause}
                """, *params)

                total_sessions = total_row['total_sessions'] or 0
                total_hands = total_row['total_hands'] or 0
                total_wins = total_row['total_wins'] or 0
                total_chips = total_row['total_chips'] or 0
                avg_win_rate = round((total_wins / total_hands) * 100) if total_hands > 0 else 0

                dur_row = await conn.fetchrow(f"""
                    SELECT AVG(end_time - start_time) as avg_dur
                    FROM coach_sessions
                    WHERE {where_clause} AND end_time IS NOT NULL
                """, *params)
                avg_duration = round(dur_row['avg_dur'] / 60000) if dur_row['avg_dur'] else 0

                gt_rows = await conn.fetch(f"""
                    SELECT COALESCE(game_type_label, game_type) as label, COUNT(*) as cnt
                    FROM coach_sessions
                    WHERE {where_clause}
                    GROUP BY label
                """, *params)
                by_game_type = {r['label']: r['cnt'] for r in gt_rows}

                mood_rows = await conn.fetch(f"""
                    SELECT COALESCE(mood_after, 'unknown') as mood, COUNT(*) as cnt
                    FROM coach_sessions
                    WHERE {where_clause}
                    GROUP BY mood
                """, *params)
                mood_dist = {r['mood']: r['cnt'] for r in mood_rows}

                stats = {
                    'total_sessions': total_sessions,
                    'total_hands': total_hands,
                    'avg_win_rate': avg_win_rate,
                    'total_chips': total_chips,
                    'avg_session_duration': avg_duration,
                    'by_game_type': by_game_type,
                    'mood_distribution': mood_dist,
                }
                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[CoachLogs][stats] ✓ 统计完成, mode={mode}, sessions={stats['total_sessions']}, "
                    f"hands={total_hands}, win_rate={stats['avg_win_rate']}%, chips={total_chips}, 耗时{elapsed:.1f}ms"
                )
                return stats
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(
                f"[CoachLogs][stats] ✗ 统计异常, mode={mode}, user_id={user_id}, "
                f"耗时{elapsed:.1f}ms, 错误: {str(e)}"
            )
            raise

    # ============================================================
    # 人格培养方案相关方法
    # ============================================================

    @classmethod
    async def get_development_plan(cls, user_id: str) -> Optional[Dict]:
        """获取用户最新的培养方案"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        logger.info(f"[DevPlan][get] → 查询培养方案, mode={mode}, user_id={user_id}")
        try:
            if not cls._pool:
                # 内存模式
                plans = cls._memory_development_plans.get(user_id, [])
                if plans:
                    latest = plans[-1]
                    elapsed = (time.time() - start) * 1000
                    logger.info(f"[DevPlan][get] ✓ 查询成功, mode={mode}, mbti={latest.get('mbti')}, 耗时{elapsed:.1f}ms")
                    return latest
                logger.info(f"[DevPlan][get] ✗ 无数据, mode={mode}, user_id={user_id}")
                return None

            async with cls._pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM development_plans WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 1",
                    user_id
                )
                if not row:
                    logger.info(f"[DevPlan][get] ✗ 无数据, mode={mode}, user_id={user_id}")
                    return None

                plan = dict(row)
                # 解析 JSON 字段
                for field in ['status', 'modules']:
                    if isinstance(plan.get(field), str):
                        plan[field] = json.loads(plan[field])

                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[DevPlan][get] ✓ 查询成功, mode={mode}, "
                    f"mbti={plan.get('mbti')}, 耗时{elapsed:.1f}ms"
                )
                return plan
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(
                f"[DevPlan][get] ✗ 查询异常, mode={mode}, "
                f"user_id={user_id}, 耗时{elapsed:.1f}ms, 错误: {str(e)}"
            )
            raise

    @classmethod
    async def create_development_plan(cls, user_id: str, plan_data: Dict) -> Dict:
        """创建培养方案"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        mbti = plan_data.get('mbti', 'N/A')
        logger.info(f"[DevPlan][create] → 创建培养方案, mode={mode}, user_id={user_id}, mbti={mbti}")
        try:
            if not cls._pool:
                # 内存模式
                plan = {
                    'id': str(uuid.uuid4())[:8],
                    'user_id': user_id,
                    'mbti': mbti,
                    'status': plan_data.get('status', {}),
                    'modules': plan_data.get('modules', {}),
                    'generated_at': plan_data.get('generatedAt', int(time.time() * 1000)),
                    'created_at': datetime.now().isoformat()
                }
                if user_id not in cls._memory_development_plans:
                    cls._memory_development_plans[user_id] = []
                cls._memory_development_plans[user_id].append(plan)
                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[DevPlan][create] ✓ 创建成功, mode={mode}, "
                    f"user_id={user_id}, mbti={mbti}, 耗时{elapsed:.1f}ms"
                )
                return plan

            async with cls._pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO development_plans (user_id, mbti, status, modules, generated_at)
                    VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
                    RETURNING *
                    """,
                    user_id,
                    mbti,
                    json.dumps(plan_data.get('status', {})),
                    json.dumps(plan_data.get('modules', {})),
                    plan_data.get('generatedAt', int(time.time() * 1000))
                )
                plan = dict(row) if row else None
                # 解析 JSON 字段
                if plan:
                    for field in ['status', 'modules']:
                        if isinstance(plan.get(field), str):
                            plan[field] = json.loads(plan[field])

                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[DevPlan][create] ✓ 创建成功, mode={mode}, "
                    f"user_id={user_id}, mbti={mbti}, 耗时{elapsed:.1f}ms"
                )
                return plan
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(
                f"[DevPlan][create] ✗ 创建异常, mode={mode}, "
                f"user_id={user_id}, mbti={mbti}, 耗时{elapsed:.1f}ms, 错误: {str(e)}"
            )
            raise

    @classmethod
    async def list_development_plans(cls, user_id: str, limit: int = 10) -> List[Dict]:
        """获取用户的培养方案历史"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        logger.info(f"[DevPlan][list] → 查询方案历史, mode={mode}, user_id={user_id}, limit={limit}")
        try:
            if not cls._pool:
                # 内存模式
                plans = cls._memory_development_plans.get(user_id, [])
                plans = sorted(plans, key=lambda p: p.get('generated_at', 0), reverse=True)[:limit]
                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[DevPlan][list] ✓ 查询成功, mode={mode}, "
                    f"数量={len(plans)}, 耗时{elapsed:.1f}ms"
                )
                return plans

            async with cls._pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT * FROM development_plans WHERE user_id = $1 ORDER BY generated_at DESC LIMIT $2",
                    user_id, limit
                )
                plans = []
                for row in rows:
                    plan = dict(row)
                    for field in ['status', 'modules']:
                        if isinstance(plan.get(field), str):
                            plan[field] = json.loads(plan[field])
                    plans.append(plan)

                elapsed = (time.time() - start) * 1000
                logger.info(
                    f"[DevPlan][list] ✓ 查询成功, mode={mode}, "
                    f"数量={len(plans)}, 耗时{elapsed:.1f}ms"
                )
                return plans
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(
                f"[DevPlan][list] ✗ 查询异常, mode={mode}, "
                f"user_id={user_id}, 耗时{elapsed:.1f}ms, 错误: {str(e)}"
            )
            raise

    # ============================================================
    # 调酒会话相关方法
    # ============================================================

    @classmethod
    async def list_bartender_sessions(cls, user_id: str, limit: int = 50,
                                        bartender: str = None) -> List[Dict]:
        """获取调酒会话列表"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        logger.info(f"[Bartender][list] → 查询会话列表, mode={mode}, user_id={user_id}")
        try:
            if not cls._pool:
                sessions = list(cls._memory_bartender_sessions.values())
                sessions = [s for s in sessions if s.get('user_id') == user_id]
                if bartender:
                    sessions = [s for s in sessions if s.get('bartender') == bartender]
                sessions.sort(key=lambda s: s.get('created_at', 0), reverse=True)
                sessions = sessions[:limit]
                elapsed = (time.time() - start) * 1000
                logger.info(f"[Bartender][list] ✓ 查询完成, mode={mode}, 结果={len(sessions)}条, 耗时{elapsed:.1f}ms")
                return sessions

            query = "SELECT * FROM bartender_sessions WHERE user_id = $1"
            params = [user_id]
            if bartender:
                query += " AND bartender = $2"
                params.append(bartender)
            query += " ORDER BY created_at DESC LIMIT $" + str(len(params) + 1)
            params.append(limit)

            async with cls._pool.acquire() as conn:
                rows = await conn.fetch(query, *params)
                sessions = []
                for row in rows:
                    s = dict(row)
                    for field in ['cocktail', 'challenge_result', 'sandbox_result']:
                        if isinstance(s.get(field), str):
                            s[field] = json.loads(s[field])
                    sessions.append(s)
                elapsed = (time.time() - start) * 1000
                logger.info(f"[Bartender][list] ✓ 查询完成, mode={mode}, 结果={len(sessions)}条, 耗时{elapsed:.1f}ms")
                return sessions
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(f"[Bartender][list] ✗ 查询异常, mode={mode}, 耗时{elapsed:.1f}ms, 错误: {str(e)}")
            raise

    @classmethod
    async def get_bartender_session(cls, session_id: int) -> Optional[Dict]:
        """获取单个调酒会话详情"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        logger.info(f"[Bartender][get] → 查询会话详情, mode={mode}, id={session_id}")
        try:
            if not cls._pool:
                session = cls._memory_bartender_sessions.get(str(session_id))
                if session:
                    elapsed = (time.time() - start) * 1000
                    logger.info(f"[Bartender][get] ✓ 查询成功, mode={mode}, id={session_id}, 耗时{elapsed:.1f}ms")
                    return session
                logger.warning(f"[Bartender][get] ✗ 会话不存在, mode={mode}, id={session_id}")
                return None

            async with cls._pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM bartender_sessions WHERE id = $1",
                    session_id
                )
                if not row:
                    logger.warning(f"[Bartender][get] ✗ 会话不存在, mode={mode}, id={session_id}")
                    return None
                s = dict(row)
                for field in ['cocktail', 'challenge_result', 'sandbox_result']:
                    if isinstance(s.get(field), str):
                        s[field] = json.loads(s[field])
                elapsed = (time.time() - start) * 1000
                logger.info(f"[Bartender][get] ✓ 查询成功, mode={mode}, id={session_id}, 耗时{elapsed:.1f}ms")
                return s
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(f"[Bartender][get] ✗ 查询异常, mode={mode}, id={session_id}, 耗时{elapsed:.1f}ms, 错误: {str(e)}")
            raise

    @classmethod
    async def create_bartender_session(cls, session_data: Dict) -> Dict:
        """创建调酒会话"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        logger.info(f"[Bartender][create] → 创建会话, mode={mode}, bartender={session_data.get('bartender')}")
        try:
            now = int(time.time() * 1000)
            if not cls._pool:
                session_id = str(uuid.uuid4())[:8]
                session = {
                    'id': session_id,
                    'user_id': session_data.get('user_id', 'demo_user'),
                    'bartender': session_data['bartender'],
                    'bartenderName': session_data.get('bartenderName'),
                    'emotion': session_data.get('emotion'),
                    'baseSpirit': session_data.get('baseSpirit'),
                    'storySeed': session_data.get('storySeed'),
                    'specialNote': session_data.get('specialNote'),
                    'zodiacCorrect': session_data.get('zodiacCorrect', False),
                    'cocktail': session_data['cocktail'],
                    'challengeResult': session_data.get('challengeResult'),
                    'sandboxResult': session_data.get('sandboxResult'),
                    'rating': session_data.get('rating'),
                    'note': session_data.get('note'),
                    'created_at': now,
                    'timestamp': now,
                }
                cls._memory_bartender_sessions[session_id] = session
                elapsed = (time.time() - start) * 1000
                logger.info(f"[Bartender][create] ✓ 创建成功, mode={mode}, id={session_id}, 耗时{elapsed:.1f}ms")
                return session

            async with cls._pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO bartender_sessions (
                        user_id, bartender, bartender_name, emotion, base_spirit,
                        story_seed, special_note, zodiac_correct, cocktail,
                        challenge_result, sandbox_result, rating, note,
                        created_at, timestamp
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                    RETURNING *
                    """,
                    session_data.get('user_id', 'demo_user'),
                    session_data['bartender'],
                    session_data.get('bartenderName'),
                    session_data.get('emotion'),
                    session_data.get('baseSpirit'),
                    session_data.get('storySeed'),
                    session_data.get('specialNote'),
                    session_data.get('zodiacCorrect', False),
                    json.dumps(session_data['cocktail']),
                    json.dumps(session_data.get('challengeResult')) if session_data.get('challengeResult') else None,
                    json.dumps(session_data.get('sandboxResult')) if session_data.get('sandboxResult') else None,
                    session_data.get('rating'),
                    session_data.get('note'),
                    now,
                    now
                )
                s = dict(row) if row else None
                if s:
                    for field in ['cocktail', 'challenge_result', 'sandbox_result']:
                        if isinstance(s.get(field), str):
                            s[field] = json.loads(s[field])
                elapsed = (time.time() - start) * 1000
                logger.info(f"[Bartender][create] ✓ 创建成功, mode={mode}, id={s.get('id') if s else 'N/A'}, 耗时{elapsed:.1f}ms")
                return s
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(f"[Bartender][create] ✗ 创建异常, mode={mode}, 耗时{elapsed:.1f}ms, 错误: {str(e)}")
            raise

    @classmethod
    async def update_bartender_session(cls, session_id: int, update_data: Dict) -> Optional[Dict]:
        """更新调酒会话（挑战赛结果、沙盘结果、评分等）"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        logger.info(f"[Bartender][update] → 更新会话, mode={mode}, id={session_id}, fields={list(update_data.keys())}")
        try:
            if not cls._pool:
                session = cls._memory_bartender_sessions.get(str(session_id))
                if not session:
                    logger.warning(f"[Bartender][update] ✗ 会话不存在, mode={mode}, id={session_id}")
                    return None
                session.update(update_data)
                cls._memory_bartender_sessions[str(session_id)] = session
                elapsed = (time.time() - start) * 1000
                logger.info(f"[Bartender][update] ✓ 更新成功, mode={mode}, id={session_id}, 耗时{elapsed:.1f}ms")
                return session

            query_parts = []
            params = []
            param_idx = 1
            for key, value in update_data.items():
                db_key = key
                if key == 'challengeResult':
                    db_key = 'challenge_result'
                elif key == 'sandboxResult':
                    db_key = 'sandbox_result'
                elif key == 'bartenderName':
                    db_key = 'bartender_name'
                elif key == 'baseSpirit':
                    db_key = 'base_spirit'
                elif key == 'storySeed':
                    db_key = 'story_seed'
                elif key == 'specialNote':
                    db_key = 'special_note'
                elif key == 'zodiacCorrect':
                    db_key = 'zodiac_correct'

                if db_key in ['cocktail', 'challenge_result', 'sandbox_result'] and value is not None:
                    query_parts.append(f"{db_key} = ${param_idx}::jsonb")
                    params.append(json.dumps(value))
                else:
                    query_parts.append(f"{db_key} = ${param_idx}")
                    params.append(value)
                param_idx += 1

            params.append(session_id)
            query = f"UPDATE bartender_sessions SET {', '.join(query_parts)} WHERE id = ${param_idx} RETURNING *"

            async with cls._pool.acquire() as conn:
                row = await conn.fetchrow(query, *params)
                if not row:
                    logger.warning(f"[Bartender][update] ✗ 会话不存在, mode={mode}, id={session_id}")
                    return None
                s = dict(row)
                for field in ['cocktail', 'challenge_result', 'sandbox_result']:
                    if isinstance(s.get(field), str):
                        s[field] = json.loads(s[field])
                elapsed = (time.time() - start) * 1000
                logger.info(f"[Bartender][update] ✓ 更新成功, mode={mode}, id={session_id}, 耗时{elapsed:.1f}ms")
                return s
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(f"[Bartender][update] ✗ 更新异常, mode={mode}, id={session_id}, 耗时{elapsed:.1f}ms, 错误: {str(e)}")
            raise

    @classmethod
    async def delete_bartender_session(cls, session_id: int) -> bool:
        """删除调酒会话"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        logger.info(f"[Bartender][delete] → 删除会话, mode={mode}, id={session_id}")
        try:
            if not cls._pool:
                if str(session_id) in cls._memory_bartender_sessions:
                    del cls._memory_bartender_sessions[str(session_id)]
                    elapsed = (time.time() - start) * 1000
                    logger.info(f"[Bartender][delete] ✓ 删除成功, mode={mode}, id={session_id}, 耗时{elapsed:.1f}ms")
                    return True
                logger.warning(f"[Bartender][delete] ✗ 会话不存在, mode={mode}, id={session_id}")
                return False

            async with cls._pool.acquire() as conn:
                result = await conn.execute(
                    "DELETE FROM bartender_sessions WHERE id = $1",
                    session_id
                )
                deleted = 'DELETE 1' in result
                elapsed = (time.time() - start) * 1000
                if deleted:
                    logger.info(f"[Bartender][delete] ✓ 删除成功, mode={mode}, id={session_id}, 耗时{elapsed:.1f}ms")
                else:
                    logger.warning(f"[Bartender][delete] ✗ 会话不存在, mode={mode}, id={session_id}")
                return deleted
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(f"[Bartender][delete] ✗ 删除异常, mode={mode}, id={session_id}, 耗时{elapsed:.1f}ms, 错误: {str(e)}")
            raise

    @classmethod
    async def get_bartender_stats(cls, user_id: str) -> Dict:
        """获取调酒统计数据"""
        import time
        start = time.time()
        mode = 'MemoryDB' if not cls._pool else 'PostgreSQL'
        logger.info(f"[Bartender][stats] → 计算统计, mode={mode}, user_id={user_id}")
        try:
            if not cls._pool:
                # 内存模式:数据量小,直接聚合
                sessions = await cls.list_bartender_sessions(user_id, limit=1000)

                if not sessions:
                    return {
                        'total_sessions': 0,
                        'bartender_count': {},
                        'emotion_count': {},
                        'base_spirit_count': {},
                        'avg_challenge_score': 0,
                        'mbti_distribution': {},
                        'recent_sessions': [],
                    }

                bartender_count = {}
                emotion_count = {}
                base_spirit_count = {}
                mbti_distribution = {}
                challenge_scores = []

                for s in sessions:
                    b = s.get('bartender') or s.get('bartenderName') or 'unknown'
                    bartender_count[b] = bartender_count.get(b, 0) + 1

                    e = s.get('emotion') or 'unknown'
                    emotion_count[e] = emotion_count.get(e, 0) + 1

                    spirit = s.get('baseSpirit') or s.get('base_spirit') or 'unknown'
                    base_spirit_count[spirit] = base_spirit_count.get(spirit, 0) + 1

                    sandbox = s.get('sandboxResult') or s.get('sandbox_result') or {}
                    mbti = sandbox.get('mbtiType') if isinstance(sandbox, dict) else None
                    if mbti:
                        mbti_distribution[mbti] = mbti_distribution.get(mbti, 0) + 1

                    challenge = s.get('challengeResult') or s.get('challenge_result') or {}
                    if isinstance(challenge, dict):
                        score = challenge.get('totalScore') or challenge.get('total_score')
                        if score:
                            challenge_scores.append(score)

                avg_challenge = round(sum(challenge_scores) / len(challenge_scores)) if challenge_scores else 0
                recent = sessions[:5]

                stats = {
                    'total_sessions': len(sessions),
                    'bartender_count': bartender_count,
                    'emotion_count': emotion_count,
                    'base_spirit_count': base_spirit_count,
                    'avg_challenge_score': avg_challenge,
                    'mbti_distribution': mbti_distribution,
                    'recent_sessions': recent,
                }
                elapsed = (time.time() - start) * 1000
                logger.info(f"[Bartender][stats] ✓ 统计完成, mode={mode}, sessions={stats['total_sessions']}, 耗时{elapsed:.1f}ms")
                return stats

            # PostgreSQL 模式:用 SQL 聚合,避免加载全部会话到内存
            async with cls._pool.acquire() as conn:
                total_row = await conn.fetchrow(
                    "SELECT COUNT(*) as total FROM bartender_sessions WHERE user_id = $1",
                    user_id
                )
                total_sessions = total_row['total'] or 0

                if total_sessions == 0:
                    return {
                        'total_sessions': 0,
                        'bartender_count': {},
                        'emotion_count': {},
                        'base_spirit_count': {},
                        'avg_challenge_score': 0,
                        'mbti_distribution': {},
                        'recent_sessions': [],
                    }

                bt_rows = await conn.fetch(
                    "SELECT COALESCE(bartender, 'unknown') as k, COUNT(*) as c "
                    "FROM bartender_sessions WHERE user_id = $1 GROUP BY k",
                    user_id
                )
                bartender_count = {r['k']: r['c'] for r in bt_rows}

                em_rows = await conn.fetch(
                    "SELECT COALESCE(emotion, 'unknown') as k, COUNT(*) as c "
                    "FROM bartender_sessions WHERE user_id = $1 GROUP BY k",
                    user_id
                )
                emotion_count = {r['k']: r['c'] for r in em_rows}

                sp_rows = await conn.fetch(
                    "SELECT COALESCE(base_spirit, 'unknown') as k, COUNT(*) as c "
                    "FROM bartender_sessions WHERE user_id = $1 GROUP BY k",
                    user_id
                )
                base_spirit_count = {r['k']: r['c'] for r in sp_rows}

                mbti_rows = await conn.fetch(
                    "SELECT sandbox_result->>'mbtiType' as k, COUNT(*) as c "
                    "FROM bartender_sessions "
                    "WHERE user_id = $1 AND sandbox_result IS NOT NULL "
                    "AND sandbox_result->>'mbtiType' IS NOT NULL GROUP BY k",
                    user_id
                )
                mbti_distribution = {r['k']: r['c'] for r in mbti_rows if r['k']}

                avg_row = await conn.fetchrow(
                    "SELECT AVG(NULLIF(COALESCE(challenge_result->>'totalScore', "
                    "challenge_result->>'total_score'), '')::numeric) as avg_score "
                    "FROM bartender_sessions "
                    "WHERE user_id = $1 AND challenge_result IS NOT NULL",
                    user_id
                )
                avg_challenge = round(float(avg_row['avg_score'])) if avg_row['avg_score'] else 0

                recent_rows = await conn.fetch(
                    "SELECT * FROM bartender_sessions WHERE user_id = $1 "
                    "ORDER BY created_at DESC LIMIT 5",
                    user_id
                )
                recent = []
                for row in recent_rows:
                    s = dict(row)
                    for field in ['cocktail', 'challenge_result', 'sandbox_result']:
                        if isinstance(s.get(field), str):
                            s[field] = json.loads(s[field])
                    recent.append(s)

                stats = {
                    'total_sessions': total_sessions,
                    'bartender_count': bartender_count,
                    'emotion_count': emotion_count,
                    'base_spirit_count': base_spirit_count,
                    'avg_challenge_score': avg_challenge,
                    'mbti_distribution': mbti_distribution,
                    'recent_sessions': recent,
                }
                elapsed = (time.time() - start) * 1000
                logger.info(f"[Bartender][stats] ✓ 统计完成, mode={mode}, sessions={stats['total_sessions']}, 耗时{elapsed:.1f}ms")
                return stats
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            logger.error(f"[Bartender][stats] ✗ 统计异常, mode={mode}, user_id={user_id}, 耗时{elapsed:.1f}ms, 错误: {str(e)}")
            raise


# 导入uuid用于内存模式
import uuid
