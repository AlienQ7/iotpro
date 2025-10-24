// src/index.js - V 1.0.0 (Minimal Router for Auth UI and API)

// =================================================================
// Backend Logic Imports
// NOTE: These files will be added next. They are placeholders for now.
// =================================================================
// import { handleSignUp, handleLogin } from './auth'; 
// import { verifyJWT } from './session'; 


// =================================================================
// Frontend Asset Imports 
// =================================================================
import AUTH_HTML from './auth.html'; 
import { STYLE_TEMPLATE } from './style-template'; 
import { COLORS } from './constants'; // Import constants for CSS generation
import AUTH_CLIENT_JS_CONTENT from './auth-client.js'; 
import CONSTANTS_JS_CONTENT from './constants.js'; 

// =================================================================
// CSS GENERATION FUNCTION
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
        '/constants.js': CONSTANTS_JS_CONTENT,
    };
    
    if (path in assetMap) {
        let content = assetMap[path];
        // Ensure content is a string if the build process wrapped it
        if (typeof content === 'object' && content !== null && typeof content.default === 'string') {
            content = content.default;
        }

        return new Response(content, {
            status: 200,
            headers: { 'Content-Type': 'application/javascript' }
        });
    }

    // -------------------------------------------------------------
    // API ROUTING (Placeholders for Auth)
    // -------------------------------------------------------------
    if (path.startsWith('/api/user/')) {
        // The actual API handlers will be placed in a separate file (auth.js)
        // This is a temporary 501 response until the auth logic is written.
        // We do this to ensure the frontend network calls don't crash the Worker.
        return new Response(JSON.stringify({ message: "API not implemented yet." }), {
            status: 501, 
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Fallback 404
    return new Response('Not Found', { status: 404 });
  },
  
  // No scheduled handler placeholder yet
};
