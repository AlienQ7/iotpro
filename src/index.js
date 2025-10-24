// src/index.js - V 1.0.1 (Auth API Integration)

// =================================================================
// Backend Logic Imports
// =================================================================
import { handleSignUp, handleLogin } from './auth'; 
// NOTE: We will add session logic and other handlers later.

// =================================================================
// Frontend Asset Imports 
// =================================================================
import AUTH_HTML from './auth.html'; 
import { STYLE_TEMPLATE } from './style-template'; 
import { COLORS } from './constants'; 
import AUTH_CLIENT_JS_CONTENT from './auth-client.js'; 
import CONSTANTS_JS_CONTENT from './constants.js'; 

// =================================================================
// CSS GENERATION FUNCTION (Unchanged)
// =================================================================
function generateCssString() {
    let css = STYLE_TEMPLATE;
    for (const key in COLORS) {
        // Replaces $BG, $ACCENT, etc. with actual color values
        css = css.replace(new RegExp(`\\$${key}`, 'g'), COLORS[key]);
    }
    return css;
}

// =================================================================
// MAIN WORKER HANDLER
// =================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // -------------------------------------------------------------
    // FRONTEND ROUTING: Serve auth.html on root path
    // -------------------------------------------------------------
    if (path === '/' || path === '/auth.html') {
        
        // 1. Generate the final CSS string
        const finalCss = generateCssString();
        const styleTag = `<style>${finalCss}</style>`;
        
        // 2. Inject CSS string into HTML head
        let injectedHtml = AUTH_HTML.replace('<!-- STYLE_INJECTION_POINT -->', styleTag);
        
        // 3. Serve the HTML
        return new Response(injectedHtml, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    // -------------------------------------------------------------
    // STATIC ASSET ROUTING (Serving JS modules)
    // -------------------------------------------------------------
    const assetMap = {
        '/auth-client.js': AUTH_CLIENT_JS_CONTENT,
        // The client-side constants file
        '/constants.js': CONSTANTS_JS_CONTENT, 
    };
    
    if (path in assetMap) {
        let content = assetMap[path];
        if (typeof content === 'object' && content !== null && typeof content.default === 'string') {
            content = content.default;
        }

        return new Response(content, {
            status: 200,
            headers: { 'Content-Type': 'application/javascript' }
        });
    }

    // -------------------------------------------------------------
    // API ROUTING (Auth Handlers)
    // -------------------------------------------------------------
    if (path.startsWith('/api/user/')) {
      switch (path) {
        case '/api/user/signup':
          if (method === 'POST') return handleSignUp(request, env);
          break;
        case '/api/user/login':
          if (method === 'POST') return handleLogin(request, env);
          break;
        default:
          return new Response(JSON.stringify({ message: 'User API Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }
    
    // Fallback 404
    return new Response('Not Found', { status: 404 });
  },
};
