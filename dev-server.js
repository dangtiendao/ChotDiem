const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

function renderGASHtml(fileName = 'Index.html') {
  const filePath = path.join(ROOT_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return `<h1>File not found: ${fileName}</h1>`;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Replace <?!= include('FileName'); ?> recursively (matches GAS template syntax)
  const includeRegex = /<\?[\s!=]*include\s*\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*\?>/gi;
  content = content.replace(includeRegex, (match, includedName) => {
    let incFile = includedName.trim();
    if (!incFile.endsWith('.html') && !incFile.endsWith('.gs')) {
      incFile += '.html';
    }
    const incPath = path.join(ROOT_DIR, incFile);
    if (fs.existsSync(incPath)) {
      return fs.readFileSync(incPath, 'utf8');
    }
    return `<!-- Missing include: ${includedName} -->`;
  });

  return content;
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/' || pathname === '/index.html') {
    try {
      const html = renderGASHtml('Index.html');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Internal Server Error: ${err.message}`);
    }
    return;
  }

  // Handle favicon and other static assets if any
  const filePath = path.join(ROOT_DIR, pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
});

let currentPort = parseInt(process.env.PORT, 10) || 3000;

function startServer(port) {
  server.listen(port, () => {
    console.log('====================================================');
    console.log(`🚀 Chốt Điểm Dev Server is running at:`);
    console.log(`👉 http://localhost:${port}`);
    console.log('====================================================');
    console.log('💡 Mỗi khi sửa file HTML/CSS/JS, chỉ cần F5 lại trình duyệt!');
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ Cổng ${currentPort} đang bận, tự động thử cổng ${currentPort + 1}...`);
    currentPort += 1;
    setTimeout(() => {
      server.close();
      startServer(currentPort);
    }, 200);
  } else {
    console.error('Lỗi khởi động máy chủ:', err);
  }
});

startServer(currentPort);

