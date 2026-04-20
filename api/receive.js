export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
  
  const { password, question, answer, url } = req.body;
  if (password !== "red-scrape-2026") return res.status(401).json({ error: "Unauthorized" });

  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`;
    await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "insertOne": {
          "document": {
            "url": url,
            "question": question,
            "answer": answer,
            "method": "bookmarklet",
            "timestamp": new Date().toISOString()
          }
        }
      })
    });

    res.status(200).json({ status: "Archived successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
