// netlify/functions/chat.js
// Netlify Function: proxy chat requests to Abacus/RouteLLM securely.
// Save this file at: netlify/functions/chat.js

exports.handler = async function (event, context) {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Parse incoming JSON
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const userMessage = (body.message || '').trim();
  if (!userMessage) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing message' }) };
  }

  // Read secrets from Netlify environment variables
  const ABACUS_API_KEY = process.env.ABACUS_API_KEY;
  const ABACUS_API_URL = process.env.ABACUS_API_URL; // e.g., your RouteLLM/Abacus endpoint

  if (!ABACUS_API_KEY || !ABACUS_API_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server misconfigured: missing ABACUS_API_KEY or ABACUS_API_URL' })
    };
  }

  try {
    // Send the user message to Abacus/RouteLLM
    // Adjust the payload structure to match the API contract your Abacus endpoint expects.
    const resp = await fetch(ABACUS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ABACUS_API_KEY}`
      },
      body: JSON.stringify({
        input: userMessage
        // add other fields here if your endpoint needs session_id, metadata, etc.
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Upstream error', resp.status, txt);
      return { statusCode: 502, body: JSON.stringify({ error: 'Upstream service error' }) };
    }

    const data = await resp.json();

    // Map Abacus response to a simple shape the frontend expects.
    // Tune this to the actual response you get from Abacus.
    const reply =
      data.reply ||
      data.output ||
      (data.choices && data.choices[0] && (data.choices[0].text || data.choices[0].message)) ||
      JSON.stringify(data);

    const result = {
      reply: String(reply),
      intent: data.intent || null,
      booking_url: data.booking_url || null,
      product_url: data.product_url || null
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
