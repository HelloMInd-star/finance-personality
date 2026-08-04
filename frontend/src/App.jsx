import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { ConfigProvider, message } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/Layout/AppLayout';
import HomePage from './pages/HomePage';
import PokerPage from './pages/PokerPage';
import PsychologyPage from './pages/PsychologyPage';
import BartenderPage from './pages/BartenderPage';
import BilliardsPage from './pages/BilliardsPage';
import StoriesPage from './pages/StoriesPage';
import CoachLogsPage from './pages/CoachLogsPage';
import ToolsPage from './pages/ToolsPage';
import './App.css';

function AppRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/poker" element={<PokerPage />} />
        <Route path="/psychology" element={<PsychologyPage />} />
        <Route path="/bartender" element={<BartenderPage />} />
        <Route path="/billiards" element={<BilliardsPage />} />
        <Route path="/stories" element={<StoriesPage />} />
        <Route path="/coach-logs" element={<CoachLogsPage />} />
        <Route path="/tools" element={<ToolsPage />} />
      </Routes>
    </AppLayout>
  );
}

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#7c3aed',
          colorInfo: '#7c3aed',
          colorSuccess: '#10b981',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorBgContainer: '#1a1030',
          colorBgElevated: '#241642',
          colorBorder: 'rgba(139, 92, 246, 0.3)',
          colorText: '#fff',
          colorTextSecondary: 'rgba(255,255,255,0.7)',
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
        components: {
          Button: {
            colorPrimary: '#7c3aed',
            colorPrimaryHover: '#8b5cf6',
            algorithm: true,
          },
          Card: {
            colorBgContainer: '#1e1340',
            colorBorderSecondary: 'rgba(139, 92, 246, 0.2)',
          },
          Modal: {
            colorBgElevated: '#1e1340',
            colorIcon: 'rgba(255,255,255,0.6)',
          },
        },
      }}
    >
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
