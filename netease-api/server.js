// 网易云 API 代理服务 - 使用 NeteaseCloudMusicApi 官方方式
// 通过自建 Express 应用添加 CORS 中间件，再代理到内部 NCM API 服务
const http = require('http');
const express = require('express');
const cors = require('cors');
const { serveNcmApi } = require('NeteaseCloudMusicApi');

const PORT = 3000;
const INTERNAL_PORT = 3001; // 内部 NCM API 端口，不对外暴露

async function start() {
  // 1. 启动内部 NCM API 服务（不对外暴露）
  await serveNcmApi({
    port: INTERNAL_PORT,
    host: '127.0.0.1',
  });

  // 2. 创建对外 Express 应用，先添加 CORS（在所有路由之前）
  const app = express();
  app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Cookie'],
    credentials: true,
  }));

  // 3. 代理所有请求到内部 NCM API
  app.use((req, res) => {
    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port: INTERNAL_PORT,
        path: req.originalUrl,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', (e) => {
      res.status(502).json({ code: 502, msg: `NCM API 代理失败: ${e.message}` });
    });
    req.pipe(proxyReq);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎵 NeteaseCloudMusicApi 服务已启动`);
    console.log(`   对外地址: http://localhost:${PORT}`);
    console.log(`   内部代理: http://127.0.0.1:${INTERNAL_PORT}`);
    console.log(`   CORS: 已启用\n`);
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
