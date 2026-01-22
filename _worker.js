export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // --- Universal CORS Headers ---
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': '*',
      // Security headers for SharedArrayBuffer (FFmpeg)
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    };

    // Helper to wrap response with CORS
    function addCors(response) {
      const newHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach(key => {
          // Overwrite existing CORS headers to ensure our permissive ones are used
          newHeaders.set(key, corsHeaders[key]);
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    // Handle Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // --- Proxy Handler ---
      if (url.pathname === '/proxy') {
        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) {
            return new Response('Missing "url" parameter', { status: 400, headers: corsHeaders });
        }

        // Construct Upstream Request Headers
        const newHeaders = new Headers();
        // 1. Set a standard User-Agent to avoid blocking
        newHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // 2. Apply Custom Headers from Query Params
        const customHeadersStr = url.searchParams.get('headers');
        if (customHeadersStr) {
            try {
                const custom = JSON.parse(customHeadersStr);
                Object.keys(custom).forEach(k => newHeaders.set(k, custom[k]));
            } catch(e) {
                console.warn('Failed to parse custom headers', e);
            }
        }

        // 3. Auto-Referer Strategy (if not provided)
        if (!newHeaders.has('Referer')) {
             try {
                const targetOrigin = new URL(targetUrl).origin;
                newHeaders.set('Referer', targetOrigin + '/');
                newHeaders.set('Origin', targetOrigin); // Some servers check Origin too
            } catch (e) {}
        }

        // 4. Fetch from Upstream
        const response = await fetch(targetUrl, {
            method: request.method,
            headers: newHeaders,
            redirect: 'follow'
        });

        // 5. Return with CORS (even if upstream returns 418/403/500)
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
          return new Response('404: Index file not found', { status: 404, headers: corsHeaders });
      }

      return addCors(response);

    } catch (e) {
      // Catch-all Error Handler
      return new Response(`Worker Exception: ${e.message}\n${e.stack}`, { 
          status: 500, 
          headers: corsHeaders 
      });
    }
  }
};
