export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { email, label, state } = data;

    if (!email || !label || !state)
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });

    // Create table if not exists
    await env.NDB.exec(`
      CREATE TABLE IF NOT EXISTS esp_switches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT,
        label TEXT,
        state TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check existing
    const existing = await env.NDB.prepare(
      "SELECT id FROM esp_switches WHERE user_email=? AND label=?"
    ).bind(email, label).first();

    if (existing) {
      await env.NDB.prepare(
        "UPDATE esp_switches SET state=?, timestamp=CURRENT_TIMESTAMP WHERE id=?"
      ).bind(state, existing.id).run();
    } else {
      // Limit to 5 switches per user
      const count = await env.DB.prepare(
        "SELECT COUNT(*) AS total FROM esp_switches WHERE user_email=?"
      ).bind(email).first();

      if (count.total >= 5) {
        return new Response(JSON.stringify({ error: "Switch limit reached (5)" }), { status: 403 });
      }

      await env.NDB.prepare(
        "INSERT INTO esp_switches (user_email, label, state) VALUES (?, ?, ?)"
      ).bind(email, label, state).run();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  if (!email)
    return new Response(JSON.stringify({ error: "Missing email" }), { status: 400 });

  await env.NDB.exec(`
    CREATE TABLE IF NOT EXISTS esp_switches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT,
      label TEXT,
      state TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const result = await env.NDB.prepare(
    "SELECT label, state, timestamp FROM esp_switches WHERE user_email=? ORDER BY id ASC"
  ).bind(email).all();

  return new Response(JSON.stringify(result.results), {
    headers: { "Content-Type": "application/json" },
  });
}
