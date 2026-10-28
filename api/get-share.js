export default async function handler(req, res) {
  try {
    // 1. Extract 'id' parameter safely across Node.js (req.query) and Edge (req.url)
    let id;
    if (req.query && req.query.id) {
      id = req.query.id;
    } else if (req.url) {
      const url = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
      id = url.searchParams.get('id');
    }

    if (!id) {
      const errorPayload = { success: false, error: 'Missing id parameter' };
      return res.status ? res.status(400).json(errorPayload) : new Response(JSON.stringify(errorPayload), { status: 400 });
    }

    const astraUrl = `${process.env.ASTRA_ENDPOINT?.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;

    // 2. Fetch document from Astra DB
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: {
        'Token': process.env.ASTRA_TOKEN || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "findOne": {
          "filter": {
            "_id": id
          }
        }
      })
    });

    const astraData = await astraRes.json();

    // 3. Extract document regardless of whether findOne or find payload format was returned
    const doc = astraData?.data?.document || astraData?.data?.documents?.[0];

    if (!doc) {
      const notFoundPayload = { success: false, error: 'Letter not found in the archives.' };
      return res.status ? res.status(404).json(notFoundPayload) : new Response(JSON.stringify(notFoundPayload), { status: 404 });
    }

    // 4. Flatten payload for share.html (which expects data.answer directly)
    const responseData = {
      success: true,
      id: doc._id || id,
      question: doc.question || '',
      answer: doc.answer || '',
      noun: doc.noun || 'artifact',
      seed: doc.seed || 42,
      created_at: doc.created_at || null
    };

    if (res && typeof res.status === 'function') {
      return res.status(200).json(responseData);
    } else {
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (err) {
    const errPayload = { success: false, error: err.message };
    if (res && typeof res.status === 'function') {
      return res.status(500).json(errPayload);
    } else {
      return new Response(JSON.stringify(errPayload), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
