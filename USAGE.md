# SongBridge

网易云公开歌单 → JSON/TXT 备份 → Apple Music 曲库匹配 → 用户核对 → 创建并分批写入歌单。

## 使用

1. 选择网易云或 QQ，输入完整歌单链接或 ID，点击读取。短链接需先打开取得完整链接。核对歌曲数；网易云公开接口不是稳定的官方开放 API，可能受地区、风控、隐私设置限制。
2. 下载 JSON 或 TXT 清单。支持把 JSON 备份重新导入，或每行粘贴「歌曲名 Tab 歌手 Tab 专辑」。
3. 选择 Apple Music 目标，下载并启动桌面助手，在网页输入连接码。
4. 在助手打开的浏览器里登录 Apple Music，开始匹配，核对版本并勾选歌曲。
5. 确认后导入。助手会查找或创建同名歌单、跳过已有歌曲，并保存进度供之后核对。

## 开发

Node 22.13+，npm run install:ci，npm run build，npm run dev。React 客户端与公开歌单接口打包为自包含 Cloudflare Worker；部署配置和发布步骤见 README。接口测试：node scripts/test-playlist.mjs。

官方文档：https://developer.apple.com/help/account/services/musickit 、https://developer.apple.com/documentation/applemusicapi 。

### Apple Music、Spotify 和 YouTube Music

Spotify、Apple Music 和 YouTube Music 歌单链接统一由桌面助手读取。粘贴链接，输入助手连接码并点击「读取歌单」。私密歌单先点击「打开网页登录」，在独立浏览器完成登录。无需配置平台开发者令牌或 OAuth 客户端。

三个目标平台都按页面上的歌单名称导入。连接助手、匹配并核对歌曲后，确认导入即可。同名歌单会追加歌曲，找不到时创建新歌单。各平台的匹配和导入进度分别保存在桌面助手。
