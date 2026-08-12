/**
 * 星盘印证卡片
 * 在整合方案输出最后展示太阳/月亮/上升/下降四位置解读
 * 无数据时显示输入表单
 */
import React, { useState, useMemo } from 'react';
import { Select, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { ZODIAC_SIGNS, generateZodiacReading } from './zodiacData.js';
import { storage } from '../../utils/storage';
import { logger } from '../../utils/logger';
import './ZodiacCard.css';

const { Option } = Select;

export default function ZodiacCard() {
  const [zodiacData, setZodiacData] = useState(() => {
    return storage.getUserState()?.zodiacData || null;
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    sun: zodiacData?.sun || undefined,
    moon: zodiacData?.moon || undefined,
    rising: zodiacData?.rising || undefined,
  });

  // 生成星盘解读
  const reading = useMemo(() => generateZodiacReading(zodiacData), [zodiacData]);

  const handleSave = () => {
    if (!form.sun || !form.moon || !form.rising) {
      message.warning('请选择全部三个星座');
      return;
    }
    const newData = { ...form };
    storage.setUserState({ zodiacData: newData });
    setZodiacData(newData);
    setEditing(false);
    message.success('星盘信息已保存');
    logger.session('[星盘] 保存星盘数据', newData);
  };

  const handleEdit = () => {
    setForm({
      sun: zodiacData?.sun,
      moon: zodiacData?.moon,
      rising: zodiacData?.rising,
    });
    setEditing(true);
  };

  // 星座选择器选项
  const signOptions = ZODIAC_SIGNS.map((s) => (
    <Option key={s.key} value={s.key}>
      {s.symbol} {s.name} · {s.element}
    </Option>
  ));

  // === 渲染输入表单(无数据或编辑中) ===
  if (!reading.hasData || editing) {
    return (
      <div className="zodiac-card">
        <div className="zodiac-card-header">
          <div className="zodiac-card-title">✦ 星盘印证 ✦</div>
          <div className="zodiac-card-subtitle">
            补充你的太阳、月亮、上升星座，获得更完整的人格画像印证
          </div>
        </div>

        <div className="zodiac-empty">
          {!reading.hasData && (
            <>
              <div className="zodiac-empty-icon">✦</div>
              <div className="zodiac-empty-text">
                补充星盘信息可获更完整画像
              </div>
            </>
          )}

          <div className="zodiac-input-form">
            <div className="zodiac-input-row">
              <span className="zodiac-input-label">☀ 太阳</span>
              <Select
                className="zodiac-input-select"
                value={form.sun}
                onChange={(v) => setForm({ ...form, sun: v })}
                placeholder="选择太阳星座"
                size="large"
                allowClear
              >
                {signOptions}
              </Select>
            </div>
            <div className="zodiac-input-row">
              <span className="zodiac-input-label">☽ 月亮</span>
              <Select
                className="zodiac-input-select"
                value={form.moon}
                onChange={(v) => setForm({ ...form, moon: v })}
                placeholder="选择月亮星座"
                size="large"
                allowClear
              >
                {signOptions}
              </Select>
            </div>
            <div className="zodiac-input-row">
              <span className="zodiac-input-label">↑ 上升</span>
              <Select
                className="zodiac-input-select"
                value={form.rising}
                onChange={(v) => setForm({ ...form, rising: v })}
                placeholder="选择上升星座"
                size="large"
                allowClear
              >
                {signOptions}
              </Select>
            </div>
            <button className="zodiac-save-btn" onClick={handleSave}>
              保存星盘信息
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === 渲染星盘解读 ===
  return (
    <div className="zodiac-card">
      <div className="zodiac-card-header">
        <div className="zodiac-card-title">✦ 星盘印证 ✦</div>
        <div className="zodiac-card-subtitle">
          你的 MBTI · 企业家人格 · 脉轮状态，在星盘中也有迹可循
        </div>
      </div>

      {/* 四位置解读 */}
      <div className="zodiac-positions">
        {reading.positions.map((pos) => {
          const isRising = pos.label === '上升';
          return (
            <div className="zodiac-position-row" key={pos.label}>
              <div className="zodiac-position-icon">{pos.symbol}</div>
              <div className="zodiac-position-content">
                <div className="zodiac-position-label">{pos.label}</div>
                {pos.sign ? (
                  <>
                    <div className="zodiac-position-sign">
                      <span className="zodiac-position-sign-symbol">{pos.sign.symbol}</span>
                      {pos.sign.name}座
                    </div>
                    <div className="zodiac-position-text">{pos.text}</div>
                    {isRising && pos.sign.mbtiTendency && (
                      <span className="zodiac-mbti-tendency">
                        MBTI 倾向：{pos.sign.mbtiTendency}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="zodiac-position-text">{pos.text}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 印证语 */}
      <div className="zodiac-footer-text">
        你的星盘和人格画像，在多个维度上形成了印证。
      </div>

      {/* 修改按钮 */}
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button
          className="zodiac-save-btn"
          style={{ height: 34, padding: '0 20px', fontSize: 13 }}
          onClick={handleEdit}
        >
          <EditOutlined style={{ marginRight: 6 }} />
          修改星盘信息
        </button>
      </div>
    </div>
  );
}
