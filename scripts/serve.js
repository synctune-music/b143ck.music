#!/usr/bin/env node
// Local preview server for src/ that mirrors GitHub Pages URL handling:
//   /foo        -> foo.html
//   /dir/       -> dir/index.html
//   /dir        -> 301 to /dir/ when dir/index.html exists
//   /foo.html   -> still served
//   anything else -> 404 (using 404.html when present)
// Usage: node scripts/serve.js [port]   (or PORT=8000 node scripts/serve.js)

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', 'src');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.argv[2] || process.env.PORT || 8000);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.woff2': 'font/woff2',
};

function isFile(file) {
    try {
        return fs.statSync(file).isFile();
    } catch {
        return false;
    }
}

function insideRoot(file) {
    return file === ROOT || file.startsWith(ROOT + path.sep);
}

// Returns { file } to serve, { redirect } for a directory without a trailing slash, or null.
function resolve(pathname) {
    const target = path.resolve(ROOT, '.' + pathname);
    if (!insideRoot(target)) return null;

    if (pathname.endsWith('/')) {
        const index = path.join(target, 'index.html');
        return isFile(index) ? { file: index } : null;
    }
    if (isFile(target)) return { file: target };
    if (isFile(target + '.html')) return { file: target + '.html' };
    if (isFile(path.join(target, 'index.html'))) return { redirect: pathname + '/' };
    return null;
}

function send(req, res, status, file, headers = {}) {
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
}

function notFound(req, res) {
    const page = path.join(ROOT, '404.html');
    if (isFile(page)) return send(req, res, 404, page);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : '404 Not Found\n');
}

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        return res.end();
    }

    let url;
    let pathname;
    try {
        url = new URL(req.url, 'http://localhost');
        pathname = decodeURIComponent(url.pathname);
    } catch {
        return notFound(req, res);
    }
    if (pathname.includes('\0')) return notFound(req, res);

    const match = resolve(pathname);
    if (!match) return notFound(req, res);
    if (match.redirect) {
        res.writeHead(301, { Location: encodeURI(match.redirect) + url.search });
        return res.end();
    }
    send(req, res, 200, match.file);
});

server.listen(PORT, HOST, () => {
    console.log(`Serving ${ROOT} at http://${HOST}:${PORT}/`);
});
