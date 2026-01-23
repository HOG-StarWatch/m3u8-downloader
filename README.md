# M3U8 Web Downloader & Transcoder

一个基于 Web 技术的现代化 M3U8 视频下载与转码工具。无需安装任何客户端，纯浏览器运行，支持实时预览、可视化切片选择、多线程下载以及本地 FFmpeg 转码。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/vue-3.x-green.svg)](https://vuejs.org/)
[![FFmpeg.wasm](https://img.shields.io/badge/ffmpeg.wasm-0.11-orange.svg)](https://ffmpeg.org/)

## 目录

- [功能特性](#-功能特性)
- [技术架构](#-技术架构)
- [快速开始](#-快速开始)
- [使用说明](#-使用说明)
- [配置说明](#-配置说明)
- [部署指南](#-部署指南)
- [性能优化](#-性能优化)
- [常见问题](#-常见问题)
- [安全说明](#-安全说明)
- [开发指南](#-开发指南)

## 功能特性

### 核心功能

| 功能 | 描述 |
|------|------|
| **可视化时间轴** | 直观展示视频切片，支持拖拽框选、智能选择 |
| **双引擎转码策略** | Mix Mode (MP4) 使用 FFmpeg.wasm 无损混流；Raw Mode (TS) 快速合并 |
| **fMP4 完整支持** | 自动捕获 HLS 中的 init 分段，解决格式兼容性问题 |
| **AES-128 解密** | 支持标准 HLS AES-128 加密流自动解密 |
| **高并发下载** | 动态并发控制（默认 6 线程），支持断点重试 |
| **后台任务队列** | 多任务自动调度，实现"边看边下"工作流 |

### UI/UX 特性

- Glassmorphism（毛玻璃）设计风格
- 多主题切换（默认、高对比度、海洋）
- 实时播放预览
- 网格可视化切片状态
- **虚拟滚动** - 大量分段时自动启用，提升性能
- 响应式布局设计

## 技术架构

```
M3U8Downloader
├── index.html          # 单页面应用（2080 行）
├── _worker.js         # Cloudflare Worker 代理（168 行）
└── README.md          # 项目文档
```

### 前端技术栈

| 组件 | 技术 | 版本 | 用途 |
|------|------|------|
| 框架 | Vue 3 | 响应式 UI |
| 播放器 | Hls.js | M3U8 流解析与播放 |
| 转码器 | FFmpeg.wasm 0.11.x | 视频格式转换（单线程） |
| 加密 | Web Crypto API | AES-128 解密 |
| 样式 | CSS Variables + Glassmorphism | 现代化 UI |

### 后端技术栈

| 组件 | 技术 | 用途 |
|------|------|------|
| 运行平台 | Cloudflare Workers / Pages | 静态托管 + CORS 代理 |
| 代理脚本 | _worker.js | 解决跨域请求限制 |

### 安全特性

| 特性 | 实现 |
|------|------|
| SSRF 防护 | URL 白名单验证 + 协议限制 |
| CORS 安全 | 源验证 + 限制方法和头 |
| 请求超时 | 30 秒超时机制 |
| 文件大小限制 | 500MB 最大代理限制 |
| 文件名验证 | 禁止非法字符，长度限制 255 |
| 内存管理 | Blob URL 自动清理 |

## 快速开始

### 方式一：Cloudflare Pages（推荐）

1. 复制项目到本地
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. 进入 **Workers & Pages** -> **Create Application** -> **Pages** -> **Upload assets**
4. 上传项目文件夹（包含 `index.html` 和 `_worker.js`）
5. 部署完成后访问分配的 URL

### 方式二：本地开发

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 启动本地开发服务器（包含 Worker 代理支持）
npx wrangler pages dev .
```

访问 `http://localhost:8788` 即可使用。

### 方式三：静态托管

直接将 `index.html` 和 `_worker.js` 部署到任何静态服务器。

**注意：** 如果不使用 `_worker.js` 代理，需要自行配置反向代理解决跨域问题。

## 使用说明

### 1. 输入源

- 在输入框粘贴 `.m3u8` 链接
- 或点击文件夹图标上传本地 `.m3u8` / `.txt` 文件

### 2. 解析与预览

- 点击"解析链接"按钮
- 系统会自动分析 Master Playlist
- 支持选择不同分辨率或音轨
- 视频播放器会自动预加载

### 3. 选择切片

**手动框选**
- 在时间轴上按住鼠标左键拖拽

**智能选择**
- 点击快捷按钮：前五分钟、前 30 秒、后 30 秒

**点选**
- 在网格视图中点击单个切片

### 4. 下载

**直接下载**
- 点击"开始下载"，系统启动多线程下载
- 绿色表示已下载完成

**后台队列**
- 点击"加入队列"，任务移至后台运行
- 可继续解析其他链接，互不干扰
- 在"后台任务队列"面板查看进度

### 5. 导出

**当前任务**
- 下载完成后点击"保存文件"

**队列任务**
- 在任务队列面板点击 **MP4** 或 **TS** 按钮

**导出格式对比**

| 格式 | 说明 | 适用场景 |
|------|------|---------|
| Raw (TS) | 原始传输流合并，适合存档 |
| Mix (MP4) | 通用媒体文件，适合播放 |

## 配置说明

### 前端配置

```javascript
const CONFIG = {
    // 并发设置
    DEFAULT_CONCURRENCY: 6,        // 默认下载数量
    MAX_CONCURRENT_TASKS: 2,      // 最大后台任务数
    MAX_RETRIES: 3,               // 最大重试次数

    // 文件大小限制
    MAX_FILE_SIZE_FOR_REMUX: 500 * 1024 * 1024,  // 500MB

    // 时间设置
    RECORDING_INTERVAL: 5000,     // 直播录制间隔（毫秒）

    // 性能设置
    VIRTUAL_SCROLL_THRESHOLD: 500,  // 启用虚拟滚动的分段阈值
    GRID_CELL_HEIGHT: 48,           // 网格单元格高度（像素）
    GRID_CELL_WIDTH: 48,            // 网格单元格宽度（像素）

    // 安全
    MAX_URL_LENGTH: 2000          // 最大 URL 长度
};
```

### Worker 配置

```javascript
const CONFIG = {
    // 允许的代理域名（空 = 允许所有）
    ALLOWED_DOMAINS: [],

    // 最大代理文件大小（字节，0 = 无限制）
    MAX_FILE_SIZE: 500 * 1024 * 1024,

    // 请求超时（毫秒）
    REQUEST_TIMEOUT: 30000,

    // 信任的源（空 = 允许所有）
    TRUSTED_ORIGINS: []
};
```

## 部署指南

### Cloudflare Pages 部署

1. **准备部署文件**
   - `index.html` - 主应用
   - `_worker.js` - Worker 代理（必需）

2. **通过 Dashboard 部署**
   - 登录 Cloudflare Dashboard
   - 进入 Workers & Pages
   - Create Application -> Pages -> Upload assets
   - 选择项目文件夹上传

3. **环境变量配置**（可选）
   - 可通过 `wrangler.toml` 配置 Worker 环境变量

### 其他平台部署

项目结构简单，可部署到任何静态托管服务：

| 平台 | 代理配置要求 |
|------|-------------|
| Vercel | 需要配置 Edge Functions 代理 |
| Netlify | 需要配置 Functions 代理 |
| GitHub Pages | 需要使用反向代理或禁用 CORS |
| Nginx / Apache | 配置反向代理规则 |

## 性能优化

### 已实现的优化

| 优化项 | 描述 | 影响 |
|---------|------|------|
| **虚拟滚动** | 大量分段（>500）时仅渲染可见部分，显著提升性能 |
| **防抖节流** | 用户输入（选择、滚动）使用防抖和节流，减少计算频率 |
| **Blob URL 清理** | 自动释放 Object URL 避免内存泄漏 |
| **AES 解密去重** | decryptSegment 共享函数，消除重复代码 |
| **计算属性优化** | downloadableCount/exportableCount 添加早期返回和缓存 |
| **竞态条件修复** | playerInitPromise 取消机制，防止状态混乱 |
| **文件名验证** | 导出前验证文件名，防止非法操作 |

### 性能对比

| 场景 | 优化前 | 优化后 |
|--------|---------|--------|
| 1000 个分段渲染 | ~500ms | ~20ms（虚拟滚动） |
| 用户频繁选择 | 每次都触发计算 | 防抖后仅触发一次 |
| 长时间使用 | Blob URL 累积导致内存泄漏 | 自动清理释放内存 |

## 常见问题

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

### Q: 大量分段时卡顿？

**A:** 已实现虚拟滚动优化：
- 分段数 < 500：正常全量渲染
- 分段数 >= 500：自动启用虚拟滚动，仅渲染可见部分

### Q: 浏览器兼容性？

**A:**
- Chrome/Edge: 完全支持
- Firefox: 完全支持
- Safari: 支持（部分旧版本可能受限）
- IE: 不支持

## 安全说明

### 安全特性

| 特性 | 描述 |
|------|------|
| SSRF 防护 | URL 解码 + 白名单验证 |
| CORS 控制 | 源验证 + 限制方法和头 |
| 文件名验证 | 禁止路径遍历和非法字符 |
| Blob 清理 | 自动释放 Object URL 避免内存泄漏 |
| 请求限制 | 30 秒超时 + 文件大小限制 |

### 生产环境建议

1. **配置域名白名单**
   ```javascript
   ALLOWED_DOMAINS: ['example.com', 'trusted-site.org']
   ```

2. **配置可信源**
   ```javascript
   TRUSTED_ORIGINS: ['https://your-domain.com']
   ```

3. **添加速率限制**（扩展 Worker）
4. **添加日志审计**

## 开发指南

### 本地开发

```bash
# 克隆项目
git clone https://github.com/your-username/m3u8-downloader.git
cd m3u8-downloader

# 启动开发服务器
npx wrangler pages dev .
```

访问 `http://localhost:8788`

### 代码结构

```
index.html
├── CSS 样式（约 400 行）
├── HTML 结构（约 500 行）
└── JavaScript 逻辑（约 1180 行）
    ├── CONFIG 配置
    ├── 工具函数（downloadBlob, decryptSegment, isValidFilename, debounce, throttle）
    ├── TranscoderService（FFmpeg 封装）
    ├── VideoPlayerService（Hls.js 封装）
    ├── Task 队列管理
    ├── 虚拟滚动逻辑
    └── 主应用逻辑
```

### 性能优化建议

1. **虚拟滚动** - 大量分段时实现窗口渲染（已实现）
2. **Web Worker 离线** - 主线程不阻塞
3. **IndexedDB 持久化** - 支持断点续传
4. **代码拆分** - 模块化提升可维护性
5. **类型安全** - 迁移到 TypeScript

### 已实现的优化

- Blob URL 自动清理防止内存泄漏
- AES 解密逻辑去重（decryptSegment 共享函数）
- 计算属性优化（downloadableCount, exportableCount）
- 竞态条件修复（playerInitPromise 取消机制）
- 文件名验证（非法字符检测）
- 虚拟滚动（时间轴和网格可视化）
- 防抖节流（用户输入优化）

## 项目结构

```
workspace/
├── index.html          # 单页面应用
├── _worker.js         # Cloudflare Worker 代理
└── README.md          # 项目文档
```

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**Made with ❤️ using Vue 3, Hls.js & FFmpeg.wasm**
