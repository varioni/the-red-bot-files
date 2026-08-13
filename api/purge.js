export default async function handler(req, res) {
  try {
    // 1. Extract parameters properly using req.query
    const { key: providedKey, word: wordToPurge } = req.query;

    // 2. Security Check
    if (!providedKey || providedKey !== process.env.PURGE_KEY) {
      return res.status(403).json({ error: "Access denied. A valid security key is required." });
    }

    if (!wordToPurge) {
      return res.status(400).json({ error: "Please specify a word to purge. Usage: /api/purge?word=[word]&key=[your-key]" });
    }

    const keyword = wordToPurge.toLowerCase().trim();
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
    
    let allDocs = [];
    let nextState = null;

    // 3. Identification: Fetch every log across all pages
    do {
      const body = { "find": { "options": { "limit": 1000 } } };
      if (nextState) body.find.options.pageState = nextState;
      
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await astraRes.json();
      allDocs = allDocs.concat(data?.data?.documents || []);
      nextState = data?.data?.nextPageState;
    } while (nextState);

    // Filter for logs mentioning the keyword
    const toDeleteIds = allDocs.filter(doc => {
      const content = `${doc.question} ${doc.answer} ${doc.noun || ""}`.toLowerCase();
      return content.includes(keyword);
    }).map(doc => doc._id);

    if (toDeleteIds.length === 0) {
      return res.status(200).json({ message: `No logs found containing the word: "${keyword}"` });
    }

    // 4. Execution: Delete them in a single batch request
    await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        "deleteMany": { "filter": { "_id": { "$in": toDeleteIds } } } 
      })
    });

    res.status(200).json({ 
      status: "Success", 
      target_word: keyword, 
      deleted_count: toDeleteIds.length 
    });

  } catch (err) {
    res.status(500).json({ error: "Purge failed", details: err.message });
  }
}
