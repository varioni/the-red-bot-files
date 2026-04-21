export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing ID" });

  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
    const response = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ "findOne": { "filter": { "_id": id } } })
    });
    const data = await response.json();
    
    if (!data.data.document) {
      return res.status(404).json({ error: "Letter not found in the archive." });
    }
    
    res.status(200).json(data.data.document);
  } catch (e) {
    res.status(500).json({ error: "The database is unreachable." });
  }
}
