// --- Configuration ---
const CONFIG = {
  // Allowed domains for proxy (empty = allow all, not recommended for production)
  ALLOWED_DOMAINS: [],
  // Max file size to proxy (bytes), 0 = no limit
  MAX_FILE_SIZE: 500 * 1024 * 1024,
  // Request timeout in milliseconds
  REQUEST_TIMEOUT: 30000,
  // Trusted origins for CORS (empty = allow all)
  TRUSTED_ORIGINS: []
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // --- CORS Headers with Origin Validation ---
    const corsHeaders = {
      'Access-Control-Allow-Origin': CONFIG.TRUSTED_ORIGINS.length === 0 ||
        CONFIG.TRUSTED_ORIGINS.includes(origin) ? origin : CONFIG.TRUSTED_ORIGINS[0] || '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': '*',
      'Access-Control-Max-Age': '86400',
      // Security headers for SharedArrayBuffer (FFmpeg)
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff'
    };

    // Helper to wrap response with CORS
    function addCors(response) {
      const newHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach(key => {
        newHeaders.set(key, corsHeaders[key]);
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    // Helper to wrap error response with CORS
    function errorResponse(message, status = 400) {
      return new Response(message, { status, headers: corsHeaders });
    }

    // URL validation helper
    function isValidUrl(targetUrl) {
      try {
        // Decode URL before validating
        const decodedUrl = decodeURIComponent(targetUrl);
        const url = new URL(decodedUrl);
        // Only allow http and https
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return false;
        }
        // Check against allowed domains if configured
        if (CONFIG.ALLOWED_DOMAINS.length > 0) {
          return CONFIG.ALLOWED_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain));
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    // Handle Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // --- Proxy Handler ---
      if (url.pathname === '/proxy') {
        const targetUrlParam = url.searchParams.get('url');
        if (!targetUrlParam) {
          return errorResponse('Missing "url" parameter');
        }

        // Validate URL before proxying
        if (!isValidUrl(targetUrlParam)) {
          return errorResponse('Invalid or blocked URL', 403);
        }

        // Construct Upstream Request Headers
        const newHeaders = new Headers();
        newHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Apply Custom Headers from Query Params
        const customHeadersStr = url.searchParams.get('headers');
        if (customHeadersStr) {
          try {
            const custom = JSON.parse(customHeadersStr);
            Object.keys(custom).forEach(k => newHeaders.set(k, custom[k]));
          } catch (e) {
            console.warn('Failed to parse custom headers', e);
          }
        }

        // Auto-Referer Strategy (if not provided)
        if (!newHeaders.has('Referer')) {
          try {
            const targetOrigin = new URL(targetUrlParam).origin;
            newHeaders.set('Referer', targetOrigin + '/');
            newHeaders.set('Origin', targetOrigin);
          } catch (e) {}
        }

        // Fetch from Upstream with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

        let response;
        try {
          response = await fetch(targetUrlParam, {
            method: request.method,
            headers: newHeaders,
            redirect: 'follow',
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

        // Check file size if Content-Length is available
        const contentLength = response.headers.get('Content-Length');
        if (contentLength && CONFIG.MAX_FILE_SIZE > 0) {
          const size = parseInt(contentLength, 10);
          if (size > CONFIG.MAX_FILE_SIZE) {
            const maxMB = (CONFIG.MAX_FILE_SIZE / 1024 / 1024).toFixed(0);
            return errorResponse(`File too large (max ${maxMB}MB)`, 413);
          }
        }

        return addCors(response);
      }

      // --- Static Assets Handler ---
      // Rewrite root to index.html
      let assetUrl = new URL(request.url);
      if (assetUrl.pathname === '/' || assetUrl.pathname === '') {
        assetUrl.pathname = '/index.html';
      }

      const assetRequest = new Request(assetUrl.toString(), {
          headers: request.headers,
          method: request.method
      });

      const response = await env.ASSETS.fetch(assetRequest);

      // Handle SPA / Fallback (Optional, mainly for debugging)
      if (response.status === 404 && url.pathname === '/') {
          return errorResponse('404: Index file not found', 404);
      }

      return addCors(response);

    } catch (e) {
      // Catch-all Error Handler
      return errorResponse(`Worker Exception: ${e.message}`, 500);
    }
  }
};
