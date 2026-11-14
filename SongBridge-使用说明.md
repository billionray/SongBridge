# SongBridge

网易云或 Spotify 歌单可以先导出 JSON/TXT，再通过本机浏览器助手 迁移到 Apple Music。智能匹配和罗马音批量匹配只处理尚未选定版本的歌曲。

## 文件与平台

在「打开 JSON / TXT 文件」中选择 SongBridge 备份、Spotify 官方导出的一个或多个 Playlist JSON，或每行三列的 TXT。TXT 用 Tab 分隔歌名、艺人和专辑，导入时可改名。JSON 的 schemaVersion 为 1，source 记录来源平台及可用链接，tracks 保留原顺序。entryId 表示歌单中的位置标识，id 是来源平台曲目 ID；重复曲目拥有不同的 entryId。duration 使用毫秒，artists、isrc 和 duration 按来源提供。旧网易云 JSON 可直接打开。本地文件在当前浏览器中解析。

来源扩展在 app/sourceReaders.ts 注册，统一输出 app/playlist.ts 的 Playlist。Apple Music 的匹配、核对和写入由本地浏览器助手执行。新平台按已实现的读取或目标写入能力接入。

## Spotify 链接

公开歌单可以直接用 Web Player 读取。启动最新版 Windows 或 macOS 本地助手，在网页选择 Spotify、粘贴链接并输入助手连接码，点击「通过 Web Player 读取」。助手滚动播放器的歌曲列表，按原始位置核对数量，保留重复项。没有曲目链接时保留可见的歌名和艺人。页面会显示已读项数和播放器总数；加载不完整时会说明缺失数量。此入口无需配置 Spotify 应用。

Spotify、Apple Music 和 YouTube Music 歌单链接统一由桌面助手读取。粘贴链接，输入助手连接码并点击「读取歌单」。私密歌单先点击「打开网页登录」，在独立浏览器完成登录。无需配置平台开发者令牌或 OAuth 客户端。

三个目标平台都按页面上的歌单名称导入。连接助手、匹配并核对歌曲后，确认导入即可。同名歌单会追加歌曲，找不到时创建新歌单。各平台的匹配和导入进度分别保存在桌面助手。

## 本机助手

Windows 在解压目录内用 PowerShell 执行 .\启动助手.ps1。macOS 双击启动助手.command，或在终端切换至解压目录执行 node start.mjs。需要 Node.js 22+。覆盖更新时保留 .state。国区浏览器助手使用 Apple Music 网页。

## 开发和验证

安装根项目及 browser-helper 的 npm 依赖后，运行 npm run build 和 npm run dev。使用 npm run build 自动打包助手并构建网页。运行 node scripts/test-spotify.mjs 验证文件与 Spotify 链接，另可传入旧 442 首 JSON 和 TXT 两个路径核验真实备份。node scripts/test-source-ui.mjs 使用本机 Edge 离线验证界面和补匹配行为。
