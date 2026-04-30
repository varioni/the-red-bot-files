export default async function handler(req, res) {
  try {
    // 1. Extract the keyword from the URL path
    // Example: /api/purge/arthur -> "arthur"
    const urlParts = req.url.split('/');
    const keyword = urlParts[urlParts.length - 1].toLowerCase();

    if (!keyword || keyword === 'purge') {
      return res.status(400).json({ error: "Please provide a specific word to purge. Usage: /api/purge/[word]" });
    }

    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
    
    // 2. Fetch the logs to identify matches
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ "find": { "options": { "limit": 1000 } } })
    });

    const astraData = await astraRes.json();
    const documents = astraData?.data?.documents || [];
    
    // 3. Filter for logs mentioning the keyword in Question, Answer, or Noun
    const toDelete = documents.filter(doc => {
      const content = `${doc.question} ${doc.answer} ${doc.noun || ""}`.toLowerCase();
      return content.includes(keyword);
    });

    if (toDelete.length === 0) {
      return res.status(200).json({ message: `No logs found containing the word: "${keyword}"` });
    }

    // 4. Execute deletion
    let deletedCount = 0;
    for (const doc of toDelete) {
      await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "deleteOne": { "filter": { "_id": doc._id } } })
      });
      deletedCount++;
    }

    res.status(200).json({ 
      status: "Success",
      target_word: keyword,
      identified: toDelete.length, 
      deleted: deletedCount 
    });

  } catch (err) {
    res.status(500).json({ error: "Purge failed", details: err.message });
  }
}
