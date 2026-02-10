# M3U8 Web Downloader & Transcoder

一个基于 Web 技术的现代化 M3U8 视频下载与转码工具。无需安装任何客户端，纯浏览器运行，支持实时预览、可视化切片选择、多线程下载以及本地 FFmpeg 转码。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/vue-3.x-green.svg)](https://vuejs.org/)
[![FFmpeg.wasm](https://img.shields.io/badge/ffmpeg.wasm-0.11-orange.svg)](https://ffmpeg.org/)
[![Cloudflare Pages](https://img.shields.io/badge/deploy-Cloudflare%20Pages-F38020.svg)](https://pages.cloudflare.com/)
[![Cloudflare Workers](https://img.shields.io/badge/edge-Cloudflare%20Workers-F38020.svg)](https://workers.cloudflare.com/)

## 目录

- [功能特性](#-功能特性)
- [系统架构](#-系统架构)
- [快速开始](#-快速开始)
- [使用说明](#-使用说明)
- [配置说明](#-配置说明)
- [跨域注入工具](#-跨域注入工具)
- [部署指南](#-部署指南)
- [常见问题](#-常见问题)

## 功能特性

### 核心优势

| 功能 | 描述 |
|------|------|
| **可视化时间轴** | 直观展示视频切片，支持拖拽框选、智能选择（前 30 秒/后 30 秒） |
| **双引擎转码** | **Mix Mode (MP4)**: 使用 FFmpeg.wasm 无损混流<br>**Raw Mode (TS)**: 快速合并，无需转码 |
| **高性能下载** | 动态并发控制（默认 6 线程），支持断点重试与后台任务队列 |
| **原生解密** | 利用 Web Crypto API 进行 AES-128 硬件加速解密，性能远超 JS 实现 |
| **大文件支持** | 集成 StreamSaver.js + ServiceWorker，直接写入硬盘，支持 GB 级文件下载 |
| **注入模式** | 独创 Shadow DOM 注入技术，无侵入式集成到任意视频网站 |

### UI/UX 特性

- **Glassmorphism**: 现代化毛玻璃设计风格
- **渲染优化**: 使用 CSS `content-visibility` 技术，轻松渲染数千个分段而不卡顿
- **多主题**: 内置默认、高对比度、海洋、暖色等多种配色方案
- **实时反馈**: 下载进度、转码状态、错误日志实时可视化

## 系统架构

### 数据流向图

```mermaid
graph TD
    User[用户输入 URL] --> Parser[M3U8 解析器]
    Parser --> Playlist{加密?}
    Playlist -- Yes --> KeyLoader[获取解密 Key]
    Playlist -- No --> Downloader
    KeyLoader --> Downloader[多线程下载器]
    Downloader --> Decrypter[Web Crypto 解密]
    Decrypter --> Buffer[内存缓冲]
    
    Buffer --> Mode{导出模式}
    Mode -- Raw(TS) --> Merger[二进制合并]
    Mode -- Mix(MP4) --> FFmpeg[FFmpeg.wasm 转码]
    
    Mermaid --> StreamSaver[StreamSaver (ServiceWorker)]
    StreamSaver --> Disk[本地硬盘]
```

### 项目结构

本项目采用**完全本地化**的依赖管理，确保离线可用性和稳定性。

```text
m3u8-downloader.git/
├── index.html          # 单页面应用入口 (Vue 3 + Logic)
├── _worker.js         # Cloudflare Worker 代理核心
├── mitm.html          # StreamSaver 中间人页面 (大文件支持)
├── serviceWorker.js   # StreamSaver 服务工作线程
├── streamsaver.js     # 流式存储库
├── js/
│   └── inject.js      # 跨域注入脚本 (Shadow DOM 实现)
├── ffmpeg.min.js      # FFmpeg 核心库
├── hls.min.js         # Hls.js 播放器核心
├── mux-mp4.js         # MP4 封装库
└── vue.global.js      # Vue 3 框架
```

## 快速开始

### 方式一：Cloudflare Pages（推荐）

本项目专为 Cloudflare Pages 设计，支持**零配置**部署。

1. **准备代码**: 克隆本项目或下载完整代码包。
2. **部署**:
   - 登录 Cloudflare Dashboard -> **Workers & Pages** -> **Create Application** -> **Pages** -> **Upload assets**。
   - 上传整个项目文件夹（包含所有 .js 和 .html 文件）。
3. **完成**: 访问分配的 `*.pages.dev` 域名即可使用。

* Fork本仓库后可以直接在 Cloudflare Pages 绑定仓库部署，无需任何配置。

### 方式二：本地开发

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 启动本地开发服务器（自动加载 _worker.js 代理）
npx wrangler pages dev .
```

访问 `http://localhost:8788` 即可使用。

### 方式三：静态服务器

如果您的视频源支持 CORS，您可以直接将所有文件部署到 Nginx/Apache 等静态服务器。
*注意：如果视频源有 CORS 限制且未配置 Worker 代理，建议使用[跨域注入工具](#-跨域注入工具)。*

## 使用说明

### 1. 基础流程
1. **输入链接**: 粘贴 `.m3u8` 地址或上传本地文件。
2. **解析**: 点击解析，系统自动加载视频预览。
3. **选择**: 默认全选，可在时间轴上拖拽框选特定片段。
4. **下载**: 点击“开始下载”，完成后自动触发浏览器下载。

### 2. 高级导出
- **MP4 (Mix)**: 兼容性最好，适合大多数播放器。使用 FFmpeg.wasm 封装。
- **TS (Raw)**: 速度最快，无损合并。适合后续专业编辑。

### 3. 后台队列
点击“加入队列”可将当前任务移至后台，您可以继续解析新的视频。支持同时运行多个下载任务。

## 跨域注入工具

针对开启了严格防盗链（Referer Check）或 CORS 限制的网站，本项目提供了专家级注入工具。

### 原理
通过在目标网站的 Context 下运行代码，直接复用当前页面的 Cookie 和 Referer，彻底绕过鉴权限制。

### 使用步骤
1. 在下载器界面下方找到 **“跨域注入工具”** 面板。
2. 点击 **“复制代码”**。
3. 打开目标视频播放页面，按 `F12` 打开开发者工具 -> **Console (控制台)**。
4. 粘贴代码并回车。
5. 页面右下角将出现悬浮窗（Shadow DOM 隔离，不影响原网页样式），直接在此操作下载。

## 配置说明

### 前端配置 (`index.html`)

```javascript
const CONFIG = {
    DEFAULT_CONCURRENCY: 6,       // 默认并发数
    MAX_FILE_SIZE_FOR_REMUX: 500 * 1024 * 1024, // 浏览器内存转码限制
    RECORDING_INTERVAL: 5000      // 直播录制切片间隔
};
```

### 代理配置 (`_worker.js`)

```javascript
const CONFIG = {
    ALLOWED_DOMAINS: [],          // 允许代理的域名白名单 (空=全部允许)
    MAX_FILE_SIZE: 500 * 1024 * 1024, // 代理文件大小限制
    REQUEST_TIMEOUT: 30000        // 请求超时时间
};
```

## 常见问题

### Q: 为什么下载大文件时提示内存不足？

**A:** 请确保 `mitm.html` 和 `serviceWorker.js` 已正确部署并在同一目录下。工具会自动降级使用 StreamSaver 直接写入硬盘，避免占用内存。

### Q: FFmpeg 加载失败？

**A:** FFmpeg.wasm 需要 `SharedArrayBuffer` 支持。Cloudflare Pages 默认环境通常支持，如在其他环境部署，请确保响应头包含：
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```
### Q: 页面一片空白？

**A:** 
1. 检查浏览器控制台是否有报错。
2. 我们已添加 5秒超时保护机制，如果 Vue 加载慢，会自动强制显示内容。
3. 确保网络环境能访问 `unpkg.com` 和 `cdnjs.cloudflare.com`（CDN 资源）。

### Q: 为什么分段没有变色？

**A:** 这是播放器加载过快导致的竞态条件，已修复。现在播放器初始化会取消之前的加载状态。

### Q: 导出 MP4 失败怎么办？

**A:**
1. 确保内存充足（浏览器限制，>1GB 可能导致内存溢出）
2. 建议分段下载后导出
3. 尝试使用 Raw (TS) 格式导出

### Q: 支持哪些视频格式？

**A:**
- 输入：M3U8 播放列表（支持 TS/MP4/MOV 等容器）
- 导出：MP4（转码）、TS（合并）
- 编码：H.264 / H.265 / VP8 / VP9（取决于源）

### Q: 无法访问某些视频源？

**A:** 可能原因：
1. CORS 限制 - Worker 已处理大部分情况
2. DRM 保护 - 本工具不支持 DRM 加密内容
3. 特殊加密 - 仅支持标准 AES-128

### Q: 下载速度慢？

**A:** 可尝试：
1. 调整并发数量（高级设置中）
2. 使用 Raw 模式跳过转码
3. 检查网络连接到 Worker

### 大量分段时卡顿？

**A:** 已实现 CSS 原生性能优化：
- 使用 `content-visibility: auto` 让浏览器自动跳过视口外内容的渲染计算。
- 相比 JS 虚拟滚动，这种方式更稳定且兼容性良好（现代浏览器）。

### Q: 浏览器兼容性？

**A:**
- Chrome/Edge: 完全支持
- Firefox: 完全支持
- Safari: 支持（部分旧版本可能受限）
- IE: 不支持

---

**Made with ❤️ By StarWatch**
