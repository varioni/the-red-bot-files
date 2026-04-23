export default async function handler(req, res) {
  const { tag } = req.query;
  
  if (!tag) return res.status(400).json({ error: "No theme specified." });

  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/logs`;
    
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ "find": { "options": { "limit": 200 } } })
    });

    const astraData = await astraRes.json();
    const documents = astraData?.data?.documents || [];
    
    // STRICT FILTER: Only matches where the tag is in the QUESTION
    const matches = documents.filter(doc => {
        const question = (doc.question || "").toLowerCase();
        return question.includes(tag.toLowerCase());
    }).slice(0, 5); 

    res.status(200).json(matches);
  } catch (err) {
    res.status(500).json({ error: "The archive is unresponsive." });
  }
}
