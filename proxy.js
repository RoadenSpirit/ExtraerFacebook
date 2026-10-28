const http = require('http');

const PORT = 5091;
const TARGET_PORT = 5090;

const server = http.createServer((req, res) => {
  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxyReq, { end: true });

  proxyReq.on('error', (err) => {
    console.error('Error en proxy:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Error de conexión con Omniroute 5090' }));
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy Omniroute corriendo en 0.0.0.0:${PORT} -> 127.0.0.1:${TARGET_PORT}`);
});
