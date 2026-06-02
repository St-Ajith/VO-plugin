const http = require('http');

const PORT = 9223;

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const log = JSON.parse(body);
        const timestamp = new Date().toLocaleTimeString();
        const prefix = log.type ? `[${log.type.toUpperCase()}]` : '[LOG]';
        console.log(`${timestamp} ${prefix} ${log.message}`, log.data ? log.data : '');
      } catch (e) {
        console.log('Raw log:', body);
      }
      res.writeHead(200);
      res.end('ok');
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`🔍 Log Proxy running at http://localhost:${PORT}`);
});
