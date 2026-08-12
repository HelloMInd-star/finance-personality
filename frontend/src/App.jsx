import React, { Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/Layout/AppLayout';
import './App.css';

// ============= 入口页 + 驾驶舱（全屏，独立于 AppLayout）=============
const HeroPage = React.lazy(() => import('./pages/HeroPage'));
const CockpitPage = React.lazy(() => import('./pages/CockpitPage'));

// ============= 路由懒加载（代码分割）=============
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const PokerPage = React.lazy(() => import('./pages/PokerPage'));
const PsychologyPage = React.lazy(() => import('./pages/PsychologyPage'));
const PersonaBartender = React.lazy(() => import('./components/PersonaBartender/PersonaBartender'));
const BartenderPageV2 = React.lazy(() => import('./pages/BartenderPageV2'));
const BilliardsPage = React.lazy(() => import('./pages/BilliardsPage'));
const FitnessPage = React.lazy(() => import('./pages/FitnessPage'));
const StoriesPage = React.lazy(() => import('./pages/StoriesPage'));
const CoachLogsPage = React.lazy(() => import('./pages/CoachLogsPage'));
const ToolsPage = React.lazy(() => import('./pages/ToolsPage'));
const MindSpeakPage = React.lazy(() => import('./pages/MindSpeakPage'));
const GameEnginePage = React.lazy(() => import('./pages/GameEnginePage'));
const RobotPage = React.lazy(() => import('./pages/RobotPage'));
const EntertainmentPage = React.lazy(() => import('./pages/EntertainmentPage'));
const GameTablePage = React.lazy(() => import('./pages/GameTablePage'));
const PersonaMirrorPage = React.lazy(() => import('./pages/PersonaMirrorPage'));
const GenomePage = React.lazy(() => import('./pages/GenomePage'));
const ChakraTest = React.lazy(() => import('./components/ChakraTest/ChakraTest'));
const TarotDraw = React.lazy(() => import('./components/TarotModule/TarotDraw'));
const ContentHubPage = React.lazy(() => import('./pages/ContentHubPage'));
const DroneDispatchPage = React.lazy(() => import('./pages/DroneDispatchPage'));
const MusicPage = React.lazy(() => import('./pages/MusicPage'));
const MobilePlayerPage = React.lazy(() => import('./pages/MobilePlayerPage'));
const CultivationPlanPage = React.lazy(() => import('./pages/CultivationPlanPage'));
const StockPage = React.lazy(() => import('./pages/StockPage'));
const FinancePage = React.lazy(() => import('./pages/FinancePage'));
const FunnelPage = React.lazy(() => import('./pages/FunnelPage'));
const RiskPage = React.lazy(() => import('./pages/RiskPage'));
const VectorPage = React.lazy(() => import('./pages/VectorPage'));
const ArchivePage = React.lazy(() => import('./pages/ArchivePage'));
const InvestBankDashboardPage = React.lazy(() => import('./pages/InvestBankDashboardPage'));
const TrustDashboardPage = React.lazy(() => import('./pages/TrustDashboardPage'));

// 懒加载 fallback
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <Spin size="large" />
  </div>
);

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* 欢迎引导页（全屏，仅首次访问） */}
        <Route path="/welcome" element={<HeroPage />} />

        {/* 主入口：Dashboard 作为工作台首页 */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* AppLayout 内的所有功能页面（包括 cockpit，统一侧边栏） */}
        <Route path="/*" element={
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/cockpit" element={<CockpitPage />} />
                <Route path="/poker" element={<PokerPage />} />
                <Route path="/psychology" element={<PsychologyPage />} />
                <Route path="/mindspeak" element={<MindSpeakPage />} />
                <Route path="/persona-mirror" element={<PersonaMirrorPage />} />
                <Route path="/game-engine" element={<GameEnginePage />} />
                <Route path="/robot" element={<RobotPage />} />
                <Route path="/entertainment" element={<EntertainmentPage />} />
                <Route path="/game-table" element={<GameTablePage />} />
                <Route path="/bartender" element={<PersonaBartender />} />
                <Route path="/bartender-classic" element={<BartenderPageV2 />} />
                <Route path="/billiards" element={<BilliardsPage />} />
                <Route path="/stock" element={<StockPage />} />
                <Route path="/finance" element={<FinancePage />} />
                <Route path="/funnel" element={<FunnelPage />} />
                <Route path="/risk" element={<RiskPage />} />
                <Route path="/vector" element={<VectorPage />} />
                <Route path="/ib-dashboard" element={<InvestBankDashboardPage />} />
                <Route path="/trust-dashboard" element={<TrustDashboardPage />} />
                <Route path="/fitness" element={<FitnessPage />} />
                <Route path="/music" element={<MusicPage />} />
                <Route path="/player/:encoded" element={<MobilePlayerPage />} />
                <Route path="/stories" element={<StoriesPage />} />
                <Route path="/coach-logs" element={<CoachLogsPage />} />
                <Route path="/genome" element={<GenomePage />} />
                <Route path="/chakra" element={<ChakraTest />} />
                <Route path="/tarot" element={<TarotDraw />} />
                <Route path="/content-hub" element={<ContentHubPage />} />
                <Route path="/drone-dispatch" element={<DroneDispatchPage />} />
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="/cultivation-plan" element={<CultivationPlanPage />} />
                <Route path="/archive" element={<ArchivePage />} />
              </Routes>
            </Suspense>
          </AppLayout>
        } />
      </Routes>
    </Suspense>
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
