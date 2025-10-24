// src/auth.js - Core logic for user registration and login.
import { v4 as uuidv4 } from 'uuid';

// =================================================================
// 1. Password and Hashing Utilities
// =================================================================

/**
 * Converts a string to an ArrayBuffer using UTF-8 encoding.
 * @param {string} str 
 * @returns {ArrayBuffer}
 */
function strToBuffer(str) {
    return new TextEncoder().encode(str);
}

/**
 * Hashes a password using SHA-256 for secure storage.
 * @param {string} password 
 * @param {string} salt 
 * @returns {Promise<string>} Hex string of the hash.
 */
async function hashPassword(password, salt) {
    // Combine password and salt
    const data = strToBuffer(password + salt);
    // Use the SubtleCrypto API in the Worker environment
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert buffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a strong, random salt.
 * @returns {string} 
 */
function generateSalt() {
    return uuidv4(); // Using UUID as a strong, unique salt
}

// =================================================================
// 2. JWT (JSON Web Token) Utilities
// =================================================================

/**
 * Creates a JWT using the HS256 algorithm.
 * @param {object} payload - The data to store in the token (e.g., { userId, email })
 * @param {string} secret - The secret key for signing the token.
 * @returns {Promise<string>} The signed JWT string.
 */
async function createJWT(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    
    // Set token to expire in 7 days
    const expiration = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); 
    const claims = { ...payload, exp: expiration, iat: Math.floor(Date.now() / 1000) };
    
    // Base64Url encode header and claims
    const base64Url = (obj) => {
        const json = JSON.stringify(obj);
        const base64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        return base64;
    };

    const encodedHeader = base64Url(header);
    const encodedClaims = base64Url(claims);

    const dataToSign = `${encodedHeader}.${encodedClaims}`;
    
    // Import the secret key
    const key = await crypto.subtle.importKey(
        'raw',
        strToBuffer(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    // Sign the data
    const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        strToBuffer(dataToSign)
    );

    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signature = signatureArray.map(b => String.fromCharCode(b)).join('');
    const encodedSignature = btoa(signature).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    return `${dataToSign}.${encodedSignature}`;
}

// =================================================================
// 3. User Authentication Handlers
// =================================================================

/**
 * Handles user registration (POST /api/user/signup)
 * @param {Request} request 
 * @param {object} env - The Worker environment object (must have env.USERS KV)
 */
export async function handleSignUp(request, env) {
    try {
        const { email, password } = await request.json();
        
        if (!email || !password || password.length < 8) {
            return new Response(JSON.stringify({ success: false, message: 'Invalid email or password (min 8 characters).' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 1. Check if user already exists in KV
        const existingUser = await env.USERS.get(email);
        if (existingUser) {
            return new Response(JSON.stringify({ success: false, message: 'User already exists.' }), {
                status: 409, headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 2. Hash password and generate user data
        const salt = generateSalt();
        const hashedPassword = await hashPassword(password, salt);
        
        const userId = uuidv4();
        const user = { 
            userId, 
            email, 
            hash: hashedPassword, 
            salt, 
            createdAt: Date.now() 
        };
        
        // 3. Store user in KV (using email as the key)
        // This is where we need the USERS KV binding
        await env.USERS.put(email, JSON.stringify(user));
        
        return new Response(JSON.stringify({ success: true, message: 'Registration successful.' }), {
            status: 201, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Signup error:", error);
        return new Response(JSON.stringify({ success: false, message: 'Internal Server Error during signup.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}


/**
 * Handles user login and session token issuance (POST /api/user/login)
 * @param {Request} request 
 * @param {object} env - The Worker environment object (must have env.USERS KV and env.JWT_SECRET)
 */
export async function handleLogin(request, env) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return new Response(JSON.stringify({ message: 'Email and password are required.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        // 1. Retrieve user from KV
        const userJson = await env.USERS.get(email);
        if (!userJson) {
            // Use generic error for security
            return new Response(JSON.stringify({ message: 'Invalid credentials.' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const user = JSON.parse(userJson);
        
        // 2. Verify password
        const candidateHash = await hashPassword(password, user.salt);
        
        if (candidateHash !== user.hash) {
            // Use generic error for security
            return new Response(JSON.stringify({ message: 'Invalid credentials.' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 3. Create and sign JWT
        const token = await createJWT({ 
            userId: user.userId, 
            email: user.email 
        }, env.JWT_SECRET); 
        
        // 4. Return token
        return new Response(JSON.stringify({ token, message: 'Login successful.' }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Login error:", error);
        return new Response(JSON.stringify({ message: 'Internal Server Error during login.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
