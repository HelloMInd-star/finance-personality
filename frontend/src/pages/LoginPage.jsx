/**
 * LoginPage —— 登录/注册页(深空紫金语系)
 * 定位:不强制全站登录;登录后解锁 AI 个性化能力(LLM 调用门控)
 * 成功后回跳来源页,默认 /dashboard
 */
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Input, Form, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, RocketOutlined } from '@ant-design/icons';
import apiClient, { setAuthToken } from '../utils/apiClient';
import localAuth from '../utils/localAuth';

// 账号体系：true=本地账号库（后端下线降级）；false=远端 /auth/*
const USE_LOCAL_AUTH = true;
import './LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login'); // login | register
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const from = location.state?.from || '/dashboard';

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = USE_LOCAL_AUTH
          ? await localAuth.login(values.username, values.password)
          : await apiClient.login(values.username, values.password);
        setAuthToken(res.access_token);
        message.success('欢迎回来 · AI 能力已解锁');
      } else {
        const res = USE_LOCAL_AUTH
          ? await localAuth.register(values.username, values.email, values.password)
          : await apiClient.register(values.username, values.email, values.password);
        setAuthToken(res.token);
        message.success('注册成功 · AI 能力已解锁');
      }
      navigate(from, { replace: true });
    } catch (e) {
      message.error(e.message || (mode === 'login' ? '登录失败' : '注册失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-nebula login-nebula-purple" />
      <div className="login-nebula login-nebula-gold" />

      <div className="login-card">
        <div className="login-logo">♠️</div>
        <h1 className="login-title">Y.Mine</h1>
        <p className="login-subtitle">人格金融孪生空间 · 登录解锁 AI 个性化能力（本地账号）</p>

        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            登录
          </button>
          <button
            className={`login-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            注册
          </button>
        </div>

        <Form form={form} onFinish={handleSubmit} size="large" requiredMark={false}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
          </Form.Item>
          {mode === 'register' && (
            <Form.Item
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '邮箱格式不正确' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="邮箱" autoComplete="email" />
            </Form.Item>
          )}
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少 6 位' }]}>
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<RocketOutlined />}
              className="login-submit-btn"
              block
            >
              {mode === 'login' ? '进入空间' : '创建我的空间'}
            </Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          <span className="login-footer-link" onClick={() => navigate('/showcase')}>
            先随便看看 →
          </span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
