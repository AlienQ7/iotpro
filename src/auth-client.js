// src/auth-client.js - Client-side logic for Authentication views

// We only need BACKEND_URL and TOKEN_KEY for fetch and storage.
import { BACKEND_URL, TOKEN_KEY } from './constants.js'; 

// =================================================================
// 1. DYNAMIC ELEMENT ACCESS & Caching
// =================================================================

let elements = null;
function getDOMElements() {
    if (!elements) {
        elements = {
            loginView: document.getElementById('login-view'),
            signupView: document.getElementById('signup-view'),
            loginForm: document.getElementById('login-form'),
            signupForm: document.getElementById('signup-form'),
            messageBox: document.getElementById('message-box'),
            loginEmail: document.getElementById('login-email'),
            loginPassword: document.getElementById('login-password'),
            signupEmail: document.getElementById('signup-email'),
            signupPassword: document.getElementById('signup-password'),
            showSignup: document.getElementById('show-signup'),
            showLogin: document.getElementById('show-login'),
            forgotPassword: document.getElementById('forgot-password'),
        };
    }
    return elements;
}

// =================================================================
// 2. UI MANIPULATION AND MESSAGE HANDLING
// =================================================================

function showMessage(type, text) {
    const { messageBox } = getDOMElements();
    if (messageBox) { 
        messageBox.textContent = text;
        // Ensure only one type class is applied
        messageBox.className = `message ${type}`; 
        messageBox.style.display = 'block';
        
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 5000);
    }
}

function switchView(view) {
    const { messageBox, loginView, signupView, loginForm, signupForm } = getDOMElements();
    
    if (loginView && signupView) {
        // Clear message box on view switch
        if (messageBox) messageBox.style.display = 'none'; 

        if (view === 'login') {
            loginView.style.display = 'block';
            signupView.style.display = 'none';
            if (loginForm) loginForm.reset();
        } else { // view === 'signup'
            loginView.style.display = 'none';
            signupView.style.display = 'block';
            if (signupForm) signupForm.reset();
        }
    } else {
        console.error("CRITICAL: Login or Signup view elements are missing from the DOM.");
    }
}

// Function to immediately check if the user is already logged in
function checkAuthStatus() {
    if (localStorage.getItem(TOKEN_KEY)) {
        console.log("User already logged in. Redirecting to dashboard...");
        showMessage('info', 'Logged in! Redirecting...');
        // TODO: In the next step, replace this with window.location.href = '/dashboard';
    }
}


// =================================================================
// 3. API CALL HANDLERS
// =================================================================

async function handleLogin(e) {
    e.preventDefault();
    const { loginForm, loginEmail, loginPassword } = getDOMElements();
    
    const email = loginEmail ? loginEmail.value : '';
    const password = loginPassword ? loginPassword.value : '';
    
    const button = loginForm.querySelector('.auth-button');
    if (button) {
        button.textContent = 'LOGGING IN...';
        button.disabled = true;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok && data.token) {
            localStorage.setItem(TOKEN_KEY, data.token);
            showMessage('success', 'Login successful! Redirecting...');
            // In a real app, redirection happens here.
            checkAuthStatus();
        } else {
            showMessage('error', data.message || 'Invalid credentials or login failed.');
        }

    } catch (error) {
        console.error('Network or server error:', error);
        showMessage('error', 'Connection error. Please try again.');
    } finally {
        if (button) {
            button.textContent = 'LOGIN';
            button.disabled = false;
        }
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const { signupForm, signupEmail, signupPassword } = getDOMElements();
    
    const email = signupEmail ? signupEmail.value : '';
    const password = signupPassword ? signupPassword.value : '';
    
    // Basic frontend password validation (Worker handles the secure part)
    if (password.length < 8) {
        showMessage('error', 'Password must be at least 8 characters long.');
        return;
    }
    
    const button = signupForm.querySelector('.auth-button');
    if (button) {
        button.textContent = 'REGISTERING...';
        button.disabled = true;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/user/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            showMessage('success', 'Account created! Please log in below.');
            switchView('login'); 
        } else {
            showMessage('error', data.message || 'Registration failed. Check your password policy (e.g., strong password).');
        }

    } catch (error) {
        console.error('Network or server error:', error);
        showMessage('error', 'Connection error. Please try again.');
    } finally {
        if (button) {
            button.textContent = 'SIGN UP';
            button.disabled = false;
        }
    }
}

// =================================================================
// 4. ATTACH EVENT LISTENERS
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const { showSignup, showLogin, forgotPassword, loginForm, signupForm } = getDOMElements();
    
    // Initial check and view setting (login view is default)
    checkAuthStatus();
    switchView('login'); // Ensure we start on the login view
    
    // Event listeners for view switching
    if (showSignup) showSignup.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('signup');
    });

    if (showLogin) showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('login');
    });

    if (forgotPassword) forgotPassword.addEventListener('click', (e) => {
        e.preventDefault();
        showMessage('info', "Password reset functionality is currently under development.");
    });
    
    // Form submission listeners
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (signupForm) signupForm.addEventListener('submit', handleSignup);
});
