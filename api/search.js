export default async function handler(req, res) {
  const { tag } = req.query;
  
  if (!tag) return res.status(400).json({ error: "No theme specified." });

  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/logs`;
    
    // We fetch the latest 100 logs to find matches for the tag
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ "find": { "options": { "limit": 100 } } })
    });

    const astraData = await astraRes.json();
    const documents = astraData?.data?.documents || [];
    
    // Filter logs that contain the word in the question or answer
    const matches = documents.filter(doc => {
        const content = `${doc.question} ${doc.answer}`.toLowerCase();
        return content.includes(tag.toLowerCase());
    }).slice(0, 5); // Show top 5 matches to keep it clean

    res.status(200).json(matches);
  } catch (err) {
    res.status(500).json({ error: "The archive is unresponsive." });
  }
}
