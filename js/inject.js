(async function () {
    // Prevent duplicate injection
    if (document.getElementById('m3u8-injector-host')) {
        alert('M3U8 Downloader is already active.');
        return;
    }

    // --- Configuration ---
    const PROXY_URL = "{{PROXY_URL}}"; // Will be replaced by index.html injector

    // --- CDNs & Fallback ---
    const CDNS = {
        vue: [
            "https://cdnjs.cloudflare.com/ajax/libs/vue/3.4.15/vue.global.prod.min.js",
            "https://unpkg.com/vue@3.4.15/dist/vue.global.prod.js"
        ],
        mux: [
            "https://cdnjs.cloudflare.com/ajax/libs/mux.js/6.3.0/mux.min.js",
            "https://unpkg.com/mux.js@6.3.0/dist/mux.min.js"
        ],
        ffmpeg: [
            "https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/ffmpeg/0.11.6/ffmpeg.min.js" // hypothetical fallback
        ],
        ffmpegCore: [
            "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
            "https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.11.0/ffmpeg-core.js"
        ]
    };

    const loadScript = (sources) => {
        return new Promise((resolve, reject) => {
            const tryLoad = (i) => {
                if (i >= sources.length) return reject(new Error('Failed to load script'));
                const s = document.createElement('script');
                s.src = sources[i];
                s.onload = resolve;
                s.onerror = () => tryLoad(i + 1);
                document.head.appendChild(s);
            };
            tryLoad(0);
        });
    };

    // --- UI Styles (Injected into Shadow DOM) ---
    const STYLES = `
        :host { all: initial; z-index: 99999; position: fixed; bottom: 20px; right: 20px; font-family: sans-serif; }
        .injector-box {
            background: rgba(15, 12, 41, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #fff;
            padding: 16px;
            border-radius: 12px;
            width: 320px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            display: flex; flex-direction: column; gap: 12px;
            transition: all 0.3s;
        }
        .injector-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 4px; }
        .title { font-weight: bold; font-size: 14px; background: linear-gradient(to right, #d946ef, #8b5cf6); -webkit-background-clip: text; color: transparent; }
        .close-btn { background: none; border: none; color: #999; cursor: pointer; font-size: 16px; }
        .close-btn:hover { color: #fff; }
        
        .input-group { display: flex; flex-direction: column; gap: 4px; }
        .label { font-size: 11px; color: #aaa; text-transform: uppercase; }
        input, select {
            background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
            color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; width: 100%; box-sizing: border-box;
        }
        input:focus, select:focus { border-color: #d946ef; outline: none; }
        
        .btn-row { display: flex; gap: 8px; }
        .btn {
            flex: 1; padding: 8px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;
            background: #333; color: #fff; transition: background 0.2s;
        }
        .btn-primary { background: linear-gradient(135deg, #d946ef, #8b5cf6); }
        .btn-primary:hover { opacity: 0.9; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .progress-bar { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; margin-top: 4px; }
        .progress-fill { height: 100%; background: #34d399; transition: width 0.3s; }
        .status { font-size: 11px; color: #ccc; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .minimized { width: 40px; height: 40px; border-radius: 50%; padding: 0; align-items: center; justify-content: center; cursor: pointer; }
        .minimized .content { display: none; }
        .minimized-icon { display: block; font-size: 20px; }
    `;

    // --- Initialization ---
    try {
        await Promise.all([
            loadScript(CDNS.vue),
            loadScript(CDNS.mux)
        ]);
        
        // Create Host
        const host = document.createElement('div');
        host.id = 'm3u8-injector-host';
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        
        const styleEl = document.createElement('style');
        styleEl.textContent = STYLES;
        shadow.appendChild(styleEl);
        
        const appRoot = document.createElement('div');
        shadow.appendChild(appRoot);

        // --- Logic (Vue App) ---
        const { createApp, ref, computed } = Vue;

        createApp({
            template: `
                <div class="injector-box" :class="{ minimized: isMinimized }">
                    <div v-if="isMinimized" @click="isMinimized = false" class="minimized-icon">📥</div>
                    <div v-else class="content">
                        <div class="injector-header">
                            <span class="title">M3U8 Downloader</span>
                            <button class="close-btn" @click="close">×</button>
                        </div>
                        
                        <div class="input-group">
                            <label class="label">URL</label>
                            <input v-model="url" placeholder="http://.../playlist.m3u8">
                        </div>
                        
                        <div class="input-group">
                            <label class="label">Format</label>
                            <select v-model="format">
                                <option value="mp4">MP4 (Mux.js)</option>
                                <option value="ts">TS (Direct)</option>
                            </select>
                        </div>

                        <div class="btn-row">
                            <button class="btn btn-primary" @click="start" :disabled="isBusy">{{ isBusy ? 'Processing...' : 'Download' }}</button>
                            <button class="btn" @click="isMinimized = true">_</button>
                        </div>

                        <div v-if="progress > 0 || status">
                            <div class="progress-bar">
                                <div class="progress-fill" :style="{ width: progress + '%' }"></div>
                            </div>
                            <div class="status" :title="status">{{ status }}</div>
                        </div>
                    </div>
                </div>
            `,
            setup() {
                const url = ref(window.location.href.includes('.m3u8') ? window.location.href : '');
                const format = ref('mp4');
                const isBusy = ref(false);
                const isMinimized = ref(false);
                const progress = ref(0);
                const status = ref('');
                
                // Logic Helpers
                const log = (msg) => { status.value = msg; console.log('[Inj]', msg); };
                
                const fetchHelper = async (u, asText = false) => {
                    // Use 'include' to send cookies with the request (crucial for injected scripts)
                    // This allows fetching protected resources on the same origin or allowed subdomains
                    const res = await fetch(u, { 
                        credentials: 'include'
                    });
                    if (!res.ok) throw new Error(`Fetch ${res.status}`);
                    return asText ? await res.text() : await res.arrayBuffer();
                };

                const decrypt = async (data, key, id) => {
                    // Simple AES-128
                    // Fetch key if needed
                    let keyData = key.data;
                    if (!keyData) {
                        keyData = await fetchBuffer(key.uri);
                        key.data = keyData; // cache
                    }
                    const keyObj = await crypto.subtle.importKey("raw", keyData, { name: "AES-CBC" }, false, ["decrypt"]);
                    // IV
                    let iv = key.iv;
                    if (!iv) {
                        const b = new ArrayBuffer(16);
                        new DataView(b).setUint32(12, id);
                        iv = new Uint8Array(b);
                    } else if (typeof iv === 'string') {
                         iv = new Uint8Array(iv.match(/.{1,2}/g).map(b => parseInt(b, 16)));
                    }
                    return await crypto.subtle.decrypt({ name: "AES-CBC", iv }, keyObj, data);
                };

                const parseM3u8 = async (u) => {
                    const txt = await (await fetch(u)).text();
                    const lines = txt.split('\n');
                    const segs = [];
                    let key = null;
                    let seq = 0;
                    
                    // Simple parser
                    for (let i = 0; i < lines.length; i++) {
                        let l = lines[i].trim();
                        if (l.startsWith('#EXT-X-KEY')) {
                            const method = l.match(/METHOD=([^,]+)/)[1];
                            const uri = l.match(/URI="([^"]+)"/)[1];
                            const iv = l.match(/IV=([^,]+)/)?.[1];
                            if (method === 'AES-128') key = { uri: new URL(uri, u).href, iv };
                            else key = null;
                        } else if (l.startsWith('#EXTINF:')) {
                            const dur = parseFloat(l.match(/[\d.]+/)[0]);
                            let next = lines[++i]?.trim();
                            while(next === '' || next.startsWith('#')) next = lines[++i]?.trim();
                            if (next) {
                                segs.push({
                                    id: seq++,
                                    url: new URL(next, u).href,
                                    duration: dur,
                                    key: key ? {...key} : null
                                });
                            }
                        }
                    }
                    return segs;
                };

                const start = async () => {
                    if (!url.value) return;
                    isBusy.value = true;
                    progress.value = 0;
                    try {
                        log('Parsing M3U8...');
                        const segs = await parseM3u8(url.value);
                        if (!segs.length) throw new Error('No segments found');
                        
                        log(`Found ${segs.length} segments. Downloading...`);
                        const blobs = [];
                        let done = 0;
                        
                        // Sequential for safety (or small concurrency)
                        for (const seg of segs) {
                            try {
                                let data = await fetchHelper(seg.url, false);
                                if (seg.key) data = await decrypt(data, seg.key, seg.id);
                                blobs.push(data);
                                done++;
                                progress.value = Math.floor((done / segs.length) * 100);
                                status.value = `Downloading ${done}/${segs.length}`;
                            } catch (e) {
                                console.error(e); // skip or retry
                            }
                        }

                        log('Processing...');
                        if (format.value === 'mp4') {
                            if (!window.muxjs) throw new Error('Mux.js not loaded');
                            const transmuxer = new muxjs.Transmuxer({ keepOriginalTimestamps: true });
                            const parts = [];
                            transmuxer.on('data', (s) => {
                                if (s.initSegment) parts.push(new Uint8Array(s.initSegment));
                                if (s.data) parts.push(new Uint8Array(s.data));
                            });
                            for (const b of blobs) transmuxer.push(new Uint8Array(b));
                            transmuxer.flush();

                            if (parts.length === 0) {
                                log('MP4 Muxing failed (empty data), fallback to TS...');
                                const finalBlob = new Blob(blobs, { type: 'video/mp2t' });
                                downloadBlob(finalBlob, 'video.ts');
                            } else {
                                const finalBlob = new Blob(parts, { type: 'video/mp4' });
                                downloadBlob(finalBlob, 'video.mp4');
                            }
                        } else {
                            const finalBlob = new Blob(blobs, { type: 'video/mp2t' });
                            downloadBlob(finalBlob, 'video.ts');
                        }
                        log('Done!');
                    } catch (e) {
                        log('Error: ' + e.message);
                        console.error(e);
                    } finally {
                        isBusy.value = false;
                    }
                };

                const downloadBlob = (b, name) => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(b);
                    a.download = name;
                    a.click();
                };

                const close = () => {
                    host.remove();
                };

                return { url, format, isBusy, isMinimized, progress, status, start, close };
            }
        }).mount(appRoot);

    } catch (e) {
        alert('Injection Failed: ' + e.message);
    }
})();
