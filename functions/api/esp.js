export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { email, label, state, renameTo } = data;

    if (!email || !label) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    await env.NDB.batch([
      env.NDB.prepare(`
        CREATE TABLE IF NOT EXISTS esp_switches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_email TEXT,
          label TEXT,
          state TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `)
    ]);

    // Rename switch
    if (renameTo) {
      const existing = await env.NDB.prepare(
        "SELECT id FROM esp_switches WHERE user_email=? AND label=?"
      ).bind(email, label).first();

      if (!existing) return new Response(JSON.stringify({ error: "Switch not found" }), { status: 404 });

      const conflict = await env.NDB.prepare(
        "SELECT id FROM esp_switches WHERE user_email=? AND label=?"
      ).bind(email, renameTo).first();

      if (conflict) return new Response(JSON.stringify({ error: "Label already exists" }), { status: 403 });

      await env.NDB.prepare(
        "UPDATE esp_switches SET label=?, timestamp=CURRENT_TIMESTAMP WHERE id=?"
      ).bind(renameTo, existing.id).run();

      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
    }

    // Toggle or add switch
    if (!state) return new Response(JSON.stringify({ error: "Missing state" }), { status: 400 });

    const existing = await env.NDB.prepare(
      "SELECT id FROM esp_switches WHERE user_email=? AND label=?"
    ).bind(email, label).first();

    if (existing) {
      await env.NDB.prepare(
        "UPDATE esp_switches SET state=?, timestamp=CURRENT_TIMESTAMP WHERE id=?"
      ).bind(state, existing.id).run();
    } else {
      const count = await env.NDB.prepare(
        "SELECT COUNT(*) AS total FROM esp_switches WHERE user_email=?"
      ).bind(email).first();

      if (count.total >= 5) {
        return new Response(JSON.stringify({ error: "Switch limit reached (5)" }), { status: 403 });
      }

      await env.NDB.prepare(
        "INSERT INTO esp_switches (user_email, label, state) VALUES (?, ?, ?)"
      ).bind(email, label, state).run();
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { email, label } = data;

    if (!email || !label)
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });

    await env.NDB.batch([
      env.NDB.prepare(`
        CREATE TABLE IF NOT EXISTS esp_switches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_email TEXT,
          label TEXT,
          state TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `)
    ]);

    const existing = await env.NDB.prepare(
      "SELECT id FROM esp_switches WHERE user_email=? AND label=?"
    ).bind(email, label).first();

    if (!existing)
      return new Response(JSON.stringify({ error: "Switch not found" }), { status: 404 });

    await env.NDB.prepare("DELETE FROM esp_switches WHERE id=?").bind(existing.id).run();

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { status: 500 });
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  if (!email)
    return new Response(JSON.stringify({ error: "Missing email" }), { status: 400 });

  try {
    await env.NDB.batch([
      env.NDB.prepare(`
        CREATE TABLE IF NOT EXISTS esp_switches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_email TEXT,
          label TEXT,
          state TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `)
    ]);

    const result = await env.NDB.prepare(
      "SELECT label, state, timestamp FROM esp_switches WHERE user_email=? ORDER BY id ASC"
    ).bind(email).all();

    return new Response(JSON.stringify(result.results), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { status: 500 });
  }
}

// 🟢 Handle device connection
export async function onRequestPut(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { email, device } = data;

    if (!email || !device)
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });

    await env.NDB.batch([
      env.NDB.prepare(`
        CREATE TABLE IF NOT EXISTS esp_connections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_email TEXT,
          device TEXT,
          connected INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `)
    ]);

    // Check if already connected
    const existing = await env.NDB.prepare(
      "SELECT id, connected FROM esp_connections WHERE user_email=? AND device=?"
    ).bind(email, device).first();

    if (existing && existing.connected === 1) {
      return new Response(JSON.stringify({ success: true, message: "Already connected" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Insert new connection
    await env.NDB.prepare(
      "INSERT INTO esp_connections (user_email, device, connected) VALUES (?, ?, 1)"
    ).bind(email, device).run();

    return new Response(JSON.stringify({ success: true, connected: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { status: 500 });
  }
}

// 🔴 Handle device disconnection
export async function onRequestPatch(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { email, device } = data;

    if (!email || !device)
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });

    await env.NDB.batch([
      env.NDB.prepare(`
        CREATE TABLE IF NOT EXISTS esp_connections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_email TEXT,
          device TEXT,
          connected INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `)
    ]);

    const existing = await env.NDB.prepare(
      "SELECT id, connected FROM esp_connections WHERE user_email=? AND device=?"
    ).bind(email, device).first();

    if (!existing)
      return new Response(JSON.stringify({ error: "Device not found" }), { status: 404 });

    // Mark as disconnected
    await env.NDB.prepare(
      "UPDATE esp_connections SET connected=0, timestamp=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(existing.id).run();

    return new Response(JSON.stringify({ success: true, disconnected: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { status: 500 });
  }
}
