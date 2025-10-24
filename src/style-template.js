// src/style-template.js
// This file contains a CSS template with $PLACEHOLDERS that the Worker will process using constants.js

export const STYLE_TEMPLATE = `
    /* Global Reset and Dark Background */
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
        background-color: $BG; 
        color: $FG; 
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        margin: 0;
        padding: 20px;
        transition: background-color 0.5s;
    }
    .auth-container {
        background: $BG;
        border: 1px solid $BORDER;
        padding: 30px 25px;
        border-radius: 12px;
        box-shadow: 0 0 40px rgba(0, 0, 0, 0.5); 
        width: 100%;
        max-width: 380px;
        transition: all 0.3s ease;
    }
    h2 {
        text-align: center;
        color: $ACCENT; 
        margin-bottom: 25px;
        font-size: 1.8em;
    }
    .input-group {
        margin-bottom: 18px;
    }
    input[type="email"],
    input[type="password"] {
        width: 100%;
        padding: 12px;
        border: 1px solid $BORDER;
        background-color: $BORDER; 
        color: $FG;
        border-radius: 8px;
        box-sizing: border-box;
        font-size: 1em;
        transition: border-color 0.2s;
    }
    input[type="email"]:focus,
    input[type="password"]:focus {
        border-color: $ACCENT;
        outline: none;
        box-shadow: 0 0 0 3px $ACCENT_LOW;
    }
    .auth-button {
        width: 100%;
        padding: 12px;
        background-color: $ACCENT;
        color: $BG; 
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1.1em;
        font-weight: bold;
        transition: background-color 0.2s, transform 0.1s;
        margin-top: 10px;
        text-transform: uppercase;
        box-shadow: 0 4px 10px rgba(255, 128, 0, 0.3);
    }
    .auth-button:hover {
        background-color: $DARK_BURN;
        box-shadow: 0 4px 15px rgba(255, 128, 0, 0.5);
    }
    .auth-button:active {
        transform: translateY(1px);
    }
    .auth-footer {
        text-align: center;
        margin-top: 20px;
        font-size: 0.9em;
        color: $FG;
    }
    .auth-footer a {
        color: $ACCENT;
        text-decoration: none;
        font-weight: 600;
        transition: color 0.2s;
    }
    .auth-footer a:hover {
        color: $AMBER_ORANGE;
        text-decoration: underline;
    }
    .message {
        padding: 12px;
        margin-bottom: 15px;
        border-radius: 8px;
        font-weight: 500;
        text-align: center;
        display: none;
        opacity: 0.9;
    }
    .message.error {
        background-color: $DANGER;
        color: white;
    }
    .message.success {
        background-color: $SUCCESS;
        color: white;
    }
    .message.info {
        background-color: $AMBER_ORANGE;
        color: $BG;
    }
    
    /* View Switching Setup - CRITICAL */
    #signup-view {
        display: none;
    }
`;
