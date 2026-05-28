// 빌드된 프론트엔드 정적 파일 서버 (포트 8080)
const express = require('express');
const path    = require('path');
const http    = require('http');
const app     = express();
const PORT    = 8080;
const DIST_DIR = require('path').join(__dirname, 'dist');

// /api 요청은 백엔드(3001)로 프록시 (경로 그대로 전달)
app.use('/api', (req, res) => {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api' + req.url,
    method: req.method,
    headers: { ...req.headers, host: 'localhost:3001' },
  };
  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  proxy.on('error', (err) => {
    console.error('[proxy error]', err.message);
    res.status(502).json({ error: 'Backend unavailable' });
  });
  req.pipe(proxy, { end: true });
});

app.use(express.static(DIST_DIR));

// SPA fallback — 정적 파일에 없는 모든 경로 → index.html
app.use((req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend running on http://localhost:${PORT}`);
  console.log(`Serving dist from: ${DIST_DIR}`);
});
