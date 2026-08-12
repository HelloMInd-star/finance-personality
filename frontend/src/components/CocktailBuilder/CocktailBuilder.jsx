/**
 * CocktailBuilder · 步进式调酒搭建器
 *
 * 封装 Y.Mine 6 步流程的 UI 抽象：
 *   1. 调酒师选择（select-bartender）
 *   2. 6 步采集流程（flow）→ 情绪/基酒/提问/手记/星座/笔记
 *   3. 生成配方（通过 onComplete 回调外传）
 *
 * 视觉：深空紫金（磨砂玻璃 + 紫金渐变 + 微妙发光）
 * 交互：选项卡 hover 微妙加深；步骤条用紫金渐变；无 Ant Design 依赖
 *
 * Props:
 *   - onComplete(recipe, context) — 流程结束，传出配方 + 采集上下文
 *   - onBartenderSelect(bartender) — 调酒师选定回调（可选）
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  molecularEngine,
  BARTENDERS,
  EMOTION_OPTIONS,
  BASE_SPIRITS,
  QUESTIONS,
  STORY_SEEDS,
  ZODIAC_SIGNS,
} from '../../utils/molecularEngine';
import { logger } from '../../utils/logger';
import './CocktailBuilder.css';

// 6 步流程定义
const STEPS = [
  { title: '情绪底色', icon: '🎭' },
  { title: '选择基酒', icon: '🥃' },
  { title: '关键提问', icon: '❓' },
  { title: '过渡手记', icon: '📝' },
  { title: '猜星座', icon: '✨' },
  { title: '特调笔记', icon: '🧪' },
];

// ============================================================
// 主组件
// ============================================================

export default function CocktailBuilder({ onComplete, onBartenderSelect, dynamicVector }) {
  // 阶段：select-bartender / flow
  const [stage, setStage] = useState('select-bartender');
  const [bartender, setBartender] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  // 流程数据
  const [emotion, setEmotion] = useState(null);
  const [baseSpirit, setBaseSpirit] = useState(null);
  const [questionAnswer, setQuestionAnswer] = useState(null);
  const [transitionNote, setTransitionNote] = useState('');
  const [zodiacGuess, setZodiacGuess] = useState(null);
  const [userZodiac, setUserZodiac] = useState(null);
  const [specialNote, setSpecialNote] = useState('');
  const [storySeed, setStorySeed] = useState(null);

  // ====== 挂载日志 + canProceed 变化追踪 ======
  useEffect(() => {
    logger.session('[CocktailBuilder] 挂载', {
      hasOnComplete: typeof onComplete === 'function',
      hasOnBartenderSelect: typeof onBartenderSelect === 'function',
    });
    return () => {
      logger.session('[CocktailBuilder] 卸载');
    };
    // 仅挂载时跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====== 调酒师选择 ======
  const handleSelectBartender = (key) => {
    const b = BARTENDERS[key];
    if (!b) {
      logger.error('[CocktailBuilder] 调酒师 key 无效', key);
      return;
    }
    logger.session('[CocktailBuilder] 选择调酒师', {
      key: b.key,
      name: b.name,
      mbti: b.mbti,
    });
    setBartender(b);
    setStage('flow');
    setCurrentStep(0);
    if (typeof onBartenderSelect === 'function') {
      logger.ui('[CocktailBuilder] 触发 onBartenderSelect 回调');
      try {
        onBartenderSelect(b);
      } catch (e) {
        logger.error('[CocktailBuilder] onBartenderSelect 回调异常', e?.message);
      }
    } else {
      logger.info('[CocktailBuilder] onBartenderSelect 未传入，跳过');
    }
  };

  // ====== 步骤推进 ======
  const canProceed = useMemo(() => {
    let ok = false;
    let reason = '';
    switch (currentStep) {
      case 0: ok = !!emotion; reason = ok ? 'emotion 已选' : 'emotion 未选'; break;
      case 1: ok = !!baseSpirit; reason = ok ? 'baseSpirit 已选' : 'baseSpirit 未选'; break;
      case 2: ok = !!questionAnswer; reason = ok ? 'questionAnswer 已选' : 'questionAnswer 未选'; break;
      case 3: ok = transitionNote.length >= 5; reason = ok ? 'transitionNote 已满 5 字' : `transitionNote 仅 ${transitionNote.length} 字`; break;
      case 4: ok = !!zodiacGuess && !!userZodiac; reason = ok ? '星座已选定' : `zodiacGuess=${zodiacGuess} userZodiac=${userZodiac}`; break;
      case 5: ok = true; reason = '终步默认放行'; break;
      default: ok = false; reason = `未知 step=${currentStep}`;
    }
    logger.ui(`[CocktailBuilder] canProceed 计算`, { step: currentStep, ok, reason });
    return ok;
  }, [currentStep, emotion, baseSpirit, questionAnswer, transitionNote, zodiacGuess, userZodiac]);

  const handleNext = () => {
    logger.ui('[CocktailBuilder] 点击「下一步」', {
      currentStep,
      canProceed,
      isLast: currentStep === STEPS.length - 1,
    });
    if (!canProceed) {
      logger.ui('[CocktailBuilder] canProceed=false，按钮应已 disabled，此处为防御性日志');
      return;
    }
    if (currentStep < STEPS.length - 1) {
      logger.session('[CocktailBuilder] 步骤推进', {
        from: `${currentStep + 1}/${STEPS.length}`,
        to: `${currentStep + 2}/${STEPS.length}`,
        title: STEPS[currentStep + 1].title,
      });
      setCurrentStep(currentStep + 1);
    } else {
      logger.session('[CocktailBuilder] 流程结束，触发配方生成');
      handleGenerate();
    }
  };

  const handlePrev = () => {
    logger.ui('[CocktailBuilder] 点击「上一步」', { currentStep });
    if (currentStep > 0) {
      logger.session('[CocktailBuilder] 返回上一步', {
        from: `${currentStep + 1}/${STEPS.length}`,
        to: `${currentStep}/${STEPS.length}`,
      });
      setCurrentStep(currentStep - 1);
    } else {
      logger.session('[CocktailBuilder] 返回调酒师选择页，清空当前调酒师');
      setStage('select-bartender');
      setBartender(null);
    }
  };

  // ====== 各步骤选项变更的统一日志包装 ======
  const pickEmotion = (key) => {
    const label = EMOTION_OPTIONS.find((e) => e.key === key)?.label || key;
    logger.ui('[CocktailBuilder] Step 1 情绪底色', { key, label });
    setEmotion(key);
  };
  const pickBaseSpirit = (key) => {
    const label = BASE_SPIRITS.find((s) => s.key === key)?.label || key;
    logger.ui('[CocktailBuilder] Step 2 基酒', { key, label });
    setBaseSpirit(key);
  };
  const pickQuestion = (label) => {
    logger.ui('[CocktailBuilder] Step 3 关键提问', { label });
    setQuestionAnswer(label);
  };
  const editTransitionNote = (val) => {
    setTransitionNote(val);
    // 仅在临界点（5 字 / 200 字）记录，避免刷屏
    if (val.length === 5 || val.length === 200) {
      logger.ui('[CocktailBuilder] Step 4 过渡手记临界', { length: val.length });
    }
  };
  const pickUserZodiac = (z) => {
    logger.ui('[CocktailBuilder] Step 5 真实星座', z);
    setUserZodiac(z);
  };
  const pickZodiacGuess = (z) => {
    logger.ui('[CocktailBuilder] Step 5 猜测星座', z);
    setZodiacGuess(z);
  };
  const pickStorySeed = (key) => {
    const label = STORY_SEEDS.find((s) => s.key === key)?.label || key;
    logger.ui('[CocktailBuilder] Step 6 故事种子', { key, label });
    setStorySeed(key);
  };
  const editSpecialNote = (val) => {
    setSpecialNote(val);
    if (val.length === 100) {
      logger.ui('[CocktailBuilder] Step 6 特调笔记满 100 字');
    }
  };

  // ====== 生成配方 ======
  const handleGenerate = () => {
    const done = logger.flow('生成调酒配方', '开始', { 调酒师: bartender?.name });

    const zodiacCorrect = zodiacGuess === userZodiac;
    logger.ui('[CocktailBuilder] 星座猜测结果', { zodiacGuess, userZodiac, zodiacCorrect });

    const input = {
      emotion: EMOTION_OPTIONS.find((e) => e.key === emotion)?.label,
      baseSpirit: BASE_SPIRITS.find((b) => b.key === baseSpirit)?.label,
      questionAnswer,
      transitionNote,
      zodiacGuess,
      zodiacCorrect,
      bartenderStyle: bartender?.key,
      storySeed: STORY_SEEDS.find((s) => s.key === storySeed)?.label,
      storyText: specialNote,
      personality: bartender?.personality,
      industry: '科技',
    };
    logger.info('[CocktailBuilder] molecularEngine.generate 入参', input);

    let recipe;
    try {
      recipe = molecularEngine.generate(input, dynamicVector);
      if (recipe?.vectorApplied) {
        logger.session('[CocktailBuilder] 动态向量已应用', recipe.vectorInfluence);
      }
    } catch (e) {
      logger.error('[CocktailBuilder] molecularEngine.generate 抛错', e?.message);
      done('失败');
      return;
    }
    if (!recipe) {
      logger.error('[CocktailBuilder] molecularEngine.generate 返回空值', { input });
      done('失败');
      return;
    }
    logger.session('[CocktailBuilder] 配方生成完成', recipe.name);
    done('完成');

    const context = {
      bartender,
      emotion,
      baseSpirit,
      questionAnswer,
      transitionNote,
      zodiacGuess,
      userZodiac,
      zodiacCorrect,
      storySeed,
      specialNote,
    };

    if (typeof onComplete === 'function') {
      logger.ui('[CocktailBuilder] 触发 onComplete 回调', {
        recipeName: recipe.name,
        hasContext: !!context,
      });
      try {
        onComplete(recipe, context);
        logger.ui('[CocktailBuilder] onComplete 回调已返回');
      } catch (e) {
        logger.error('[CocktailBuilder] onComplete 回调异常', e?.message);
      }
    } else {
      logger.error('[CocktailBuilder] onComplete 未传入，配方丢失', { recipeName: recipe.name });
    }
  };

  // ====== 渲染 ======
  if (stage === 'select-bartender') {
    return <BartenderSelect onSelect={handleSelectBartender} />;
  }

  return (
    <div className="cb-builder">
      {/* 顶部调酒师条 */}
      <header className="cb-builder__header">
        <div className="cb-builder__bartender">
          <span
            className="cb-builder__bartender-icon"
            style={{ color: bartender?.color }}
          >
            {bartender?.icon}
          </span>
          <div>
            <div className="cb-builder__bartender-name">{bartender?.name}</div>
            <div className="cb-builder__bartender-title">{bartender?.title}</div>
          </div>
        </div>
        <button
          type="button"
          className="cb-builder__reset"
          onClick={handlePrev}
          aria-label={currentStep === 0 ? '返回选择' : '上一步'}
        >
          {currentStep === 0 ? '← 重新选择' : '← 上一步'}
        </button>
      </header>

      {/* 步骤条 */}
      <ol className="cb-steps" aria-label="调酒流程进度">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className={`cb-step ${i === currentStep ? 'is-active' : ''} ${i < currentStep ? 'is-done' : ''}`}
          >
            <span className="cb-step__icon">{s.icon}</span>
            <span className="cb-step__title">{s.title}</span>
          </li>
        ))}
      </ol>

      {/* 步骤内容 */}
      <section className="cb-content">
        <StepHeader
          icon={STEPS[currentStep].icon}
          title={STEPS[currentStep].title}
          desc={getStepDesc(currentStep, bartender)}
        />

        {currentStep === 0 && (
          <OptionList
            options={EMOTION_OPTIONS.map((o) => ({ key: o.key, label: o.label, desc: o.desc }))}
            value={emotion}
            onPick={pickEmotion}
          />
        )}

        {currentStep === 1 && (
          <div className="cb-grid cb-grid--spirit">
            {BASE_SPIRITS.map((s) => (
              <button
                type="button"
                key={s.key}
                className={`cb-spirit ${baseSpirit === s.key ? 'is-on' : ''}`}
                onClick={() => pickBaseSpirit(s.key)}
              >
                <span className="cb-spirit__icon">{s.icon}</span>
                <span className="cb-spirit__label">{s.label}</span>
                <span className="cb-spirit__flavor">{s.flavor}</span>
              </button>
            ))}
          </div>
        )}

        {currentStep === 2 && (
          <OptionList
            options={(QUESTIONS[baseSpirit] || []).map((q) => ({ key: q.label, label: q.label, desc: q.desc }))}
            value={questionAnswer}
            onPick={pickQuestion}
          />
        )}

        {currentStep === 3 && (
          <div className="cb-textarea-wrap">
            <textarea
              className="cb-textarea"
              value={transitionNote}
              onChange={(e) => editTransitionNote(e.target.value)}
              placeholder="比如：今天加班到很晚，想放松一下..."
              rows={4}
              maxLength={200}
            />
            <span className="cb-textarea__count">{transitionNote.length}/200</span>
          </div>
        )}

        {currentStep === 4 && (
          <div className="cb-zodiac">
            <div className="cb-zodiac__group">
              <div className="cb-zodiac__label">你的真实星座是？</div>
              <ZodiacPicker value={userZodiac} onChange={pickUserZodiac} />
            </div>
            <div className="cb-zodiac__divider" />
            <div className="cb-zodiac__group">
              <div className="cb-zodiac__label">{bartender?.name} 猜你是...</div>
              <ZodiacPicker value={zodiacGuess} onChange={pickZodiacGuess} />
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="cb-final">
            <div className="cb-final__seeds">
              {STORY_SEEDS.map((s) => (
                <button
                  type="button"
                  key={s.key}
                  className={`cb-seed ${storySeed === s.key ? 'is-on' : ''}`}
                  onClick={() => pickStorySeed(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="cb-textarea-wrap">
              <div className="cb-textarea__label">💡 特调笔记（选填）</div>
              <textarea
                className="cb-textarea"
                value={specialNote}
                onChange={(e) => editSpecialNote(e.target.value)}
                placeholder="有什么特别想说的？调酒师会把它融入配方..."
                rows={3}
                maxLength={100}
              />
              <span className="cb-textarea__count">{specialNote.length}/100</span>
            </div>
          </div>
        )}
      </section>

      {/* 底部按钮 */}
      <footer className="cb-footer">
        <button
          type="button"
          className="cb-btn cb-btn--ghost"
          onClick={handlePrev}
        >
          {currentStep === 0 ? '← 返回选择' : '← 上一步'}
        </button>
        <button
          type="button"
          className="cb-btn cb-btn--primary"
          disabled={!canProceed}
          onClick={handleNext}
        >
          {currentStep === STEPS.length - 1 ? '🧪 生成特调配方' : '下一步 →'}
        </button>
      </footer>
    </div>
  );
}

// ============================================================
// 子组件
// ============================================================

function getStepDesc(step, bartender) {
  const descs = [
    '选择最贴近你现在状态的描述',
    '基酒会奠定整杯酒的风味基础',
    `关于这杯酒，你有什么偏好？`,
    '关于此刻的心境，随便写点什么（5字以上）',
    `先告诉调酒师你的星座，再猜猜 TA 猜不猜得中`,
    '故事种子会影响酒的名字和呈现方式',
  ];
  return descs[step] || '';
}

function StepHeader({ icon, title, desc }) {
  return (
    <div className="cb-step-header">
      <span className="cb-step-header__icon">{icon}</span>
      <h3 className="cb-step-header__title">{title}</h3>
      <p className="cb-step-header__desc">{desc}</p>
    </div>
  );
}

function OptionList({ options, value, onPick }) {
  return (
    <div className="cb-options">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.key}
          className={`cb-option ${value === opt.key ? 'is-on' : ''}`}
          onClick={() => onPick(opt.key)}
        >
          <span className="cb-option__label">{opt.label}</span>
          {opt.desc && <span className="cb-option__desc">{opt.desc}</span>}
        </button>
      ))}
    </div>
  );
}

function ZodiacPicker({ value, onChange }) {
  return (
    <div className="cb-zodiac__grid">
      {ZODIAC_SIGNS.map((z) => (
        <button
          type="button"
          key={z}
          className={`cb-zodiac__chip ${value === z ? 'is-on' : ''}`}
          onClick={() => onChange(z)}
        >
          {z}
        </button>
      ))}
    </div>
  );
}

function BartenderSelect({ onSelect }) {
  return (
    <div className="cb-select">
      <header className="cb-select__hero">
        <div className="cb-select__icon">🍸</div>
        <h2 className="cb-select__title">分子调酒实验室</h2>
        <div className="cb-select__divider" />
        <p className="cb-select__desc">
          选择一位调酒师，开始你的分子调酒体验。
          <br />
          六步流程，采集情绪、故事与人格，生成专属于你的那一杯。
        </p>
      </header>

      <div className="cb-select__grid">
        {Object.values(BARTENDERS).map((b, idx) => (
          <button
            type="button"
            key={b.key}
            className="cb-bartender"
            onClick={() => onSelect(b.key)}
            style={{ '--b-color': b.color }}
          >
            <span className="cb-bartender__number">0{idx + 1}</span>
            <span
              className="cb-bartender__avatar"
              style={{ background: `linear-gradient(135deg, ${b.color}33, ${b.color}11)`, borderColor: `${b.color}66` }}
            >
              {b.icon}
            </span>
            <h3 className="cb-bartender__name">{b.name}</h3>
            <span
              className="cb-bartender__title-tag"
              style={{ background: `${b.color}22`, color: b.color }}
            >
              {b.title}
            </span>
            <span className="cb-bartender__mbti">MBTI · {b.mbti}</span>
            <p className="cb-bartender__style">{b.style}</p>
            <div className="cb-bartender__tags">
              {b.specialty.split('、').map((tag, i) => (
                <span key={i} className="cb-bartender__tag">{tag}</span>
              ))}
            </div>
            <footer className="cb-bartender__footer">
              <span className="cb-bartender__hint">6 步流程 · 约 3 分钟</span>
              <span className="cb-bartender__cta">开始 →</span>
            </footer>
          </button>
        ))}
      </div>
    </div>
  );
}
