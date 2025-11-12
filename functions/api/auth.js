// functions/api/auth.js
export async function onRequest(context) {
  const { request, env } = context;
  const NDB = env.NDB;
  const SECRET = env.my_secret;

  const CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // --- Helper functions ---
  async function hashPassword(str) {
    const enc = new TextEncoder();
    const data = enc.encode(String(str));
    const digest = await crypto.subtle.digest("SHA-256", data);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function makeRecoveryCode(len = 12) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => chars[b % chars.length]).join("");
  }

  // --- JWT handling ---
  async function generateJWT(payload) {
    const header = { alg: "HS256", typ: "JWT" };
    const encoder = new TextEncoder();

    const base64url = (obj) =>
      btoa(JSON.stringify(obj))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const headerEnc = base64url(header);
    const payloadEnc = base64url(payload);
    const unsignedToken = `${headerEnc}.${payloadEnc}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(unsignedToken));
    const sigBytes = new Uint8Array(signature);
    const sigB64 = btoa(String.fromCharCode(...sigBytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return `${unsignedToken}.${sigB64}`;
  }

  async function verifyJWT(token) {
    try {
      const [headerB64, payloadB64, sigB64] = token.split(".");
      if (!headerB64 || !payloadB64 || !sigB64) return null;

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      const unsignedToken = `${headerB64}.${payloadB64}`;
      const sigBin = Uint8Array.from(atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")), c =>
        c.charCodeAt(0)
      );

      const valid = await crypto.subtle.verify(
        "HMAC",
        key,
        sigBin,
        encoder.encode(unsignedToken)
      );
      if (!valid) return null;

      const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
      if (Date.now() / 1000 > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  }

  // --- Parse request body ---
  let body = {};
  try {
    if (["POST", "PUT"].includes(request.method)) {
      body = await request.json();
    }
  } catch {
    body = {};
  }

  const url = new URL(request.url);
  let action = (body.action || url.searchParams.get("action") || "").toLowerCase();
  if (!action) {
    return new Response(JSON.stringify({ error: "Missing action" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  // ---------------------------
  // SIGNUP
  // ---------------------------
  if (action === "signup") {
    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const phone = body.phone || null;
    const gender = body.gender || null;

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, email, password" }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    try {
      const existing = await NDB.prepare("SELECT id FROM users WHERE email = ?")
        .bind(email)
        .first();
      if (existing) {
        return new Response(JSON.stringify({ error: "User already exists" }), {
          status: 409,
          headers: CORS_HEADERS,
        });
      }

      const hashedPassword = await hashPassword(password);
      const recoveryCode = makeRecoveryCode(12);
      const recoveryHashed = await hashPassword(recoveryCode);

      await NDB.prepare(
        "INSERT INTO users (name, email, password, phone, gender, recovery_code) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(name, email, hashedPassword, phone, gender, recoveryHashed).run();

      return new Response(
        JSON.stringify({ message: "Signup successful", recovery_code: recoveryCode }),
        { status: 201, headers: CORS_HEADERS }
      );
    } catch (err) {
      console.error("Signup error:", err);
      return new Response(JSON.stringify({ error: "Internal server error (signup)" }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  // ---------------------------
  // LOGIN
  // ---------------------------
  if (action === "login") {
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing email or password" }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    try {
      const user = await NDB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401,
          headers: CORS_HEADERS,
        });
      }

      const hashed = await hashPassword(password);
      const stored = user.password || "";
      const valid = hashed === stored || password === stored;
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401,
          headers: CORS_HEADERS,
        });
      }

      // create JWT
      const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24h
      const token = await generateJWT({ id: user.id, email: user.email, exp });

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        gender: user.gender ?? null,
      };

      return new Response(
        JSON.stringify({ message: "Login successful", token, user: safeUser }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      console.error("Login error:", err);
      return new Response(JSON.stringify({ error: "Internal server error (login)" }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  // ---------------------------
  // FORGOT / RECOVER
  // ---------------------------
  if (action === "forgot") {
    const email = (body.email || "").trim().toLowerCase();
    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    try {
      const user = await NDB.prepare(
        "SELECT id, recovery_code FROM users WHERE email = ?"
      ).bind(email).first();

      if (!user) {
        return new Response(
          JSON.stringify({ message: "If an account exists, instructions were sent." }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      if (body.recovery_code && body.new_password) {
        const provided = String(body.recovery_code);
        const providedHash = await hashPassword(provided);
        if (providedHash !== user.recovery_code) {
          return new Response(JSON.stringify({ error: "Invalid recovery code" }), {
            status: 401,
            headers: CORS_HEADERS,
          });
        }

        const newHashed = await hashPassword(String(body.new_password));
        const newCode = makeRecoveryCode(12);
        const newCodeHashed = await hashPassword(newCode);

        await NDB.prepare(
          "UPDATE users SET password = ?, recovery_code = ? WHERE id = ?"
        ).bind(newHashed, newCodeHashed, user.id).run();

        return new Response(
          JSON.stringify({ message: "Password reset successful", recovery_code: newCode }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      return new Response(
        JSON.stringify({
          message: "If an account exists, follow the reset instructions you received.",
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      console.error("Forgot error:", err);
      return new Response(JSON.stringify({ error: "Internal server error (forgot)" }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  // ---------------------------
  // DELETE ACCOUNT
  // ---------------------------
  if (action === "delete") {
    const email = (body.email || "").trim().toLowerCase();
    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    try {
      const result = await NDB.prepare("DELETE FROM users WHERE email = ?")
        .bind(email)
        .run();
      if (result.meta.changes > 0) {
        return new Response(
          JSON.stringify({ success: true, message: "Account deleted" }),
          { status: 200, headers: CORS_HEADERS }
        );
      } else {
        return new Response(
          JSON.stringify({ success: false, error: "User not found" }),
          { status: 404, headers: CORS_HEADERS }
        );
      }
    } catch (err) {
      console.error("Delete account error:", err);
      return new Response(
        JSON.stringify({ success: false, error: "Internal server error (delete)" }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: CORS_HEADERS,
  });
}
