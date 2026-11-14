# SongBridge

支持从网易云、QQ 音乐、Spotify、Apple Music、YouTube Music 读取歌单，导出 JSON/TXT，并通过桌面助手写入 Apple Music、Spotify 或 YouTube Music。

## 部署到 Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/billionray/SongBridge)

## 本机助手

Windows 在解压目录内用 PowerShell 执行 `.\start.ps1`。macOS 双击 `start.command`。需要 Node.js 22+。覆盖更新时保留 `.state`。

## 开发和验证

使用 Node.js 22.13+、npm 和 Python 3。在源码目录运行：

```sh
npm ci
npm ci --prefix browser-helper
npm run build
npm test
node --test browser-helper/tests.mjs browser-helper/*.test.mjs
npm run dev
```

本地预览地址为 http://127.0.0.1:5173 

SongBridge 采用 [GNU AGPL-3.0-only 许可证](LICENSE)。
