export default async function handler(req, res) {
  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/logs`;
    
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      // Fetching 500 logs. Since you are on Pro, this is now very stable.
      body: JSON.stringify({ "find": { "options": { "limit": 500 } } })
    });

    const astraData = await astraRes.json();
    const documents = astraData?.data?.documents || [];
    
    // We send the raw text to the frontend so the NLP library can process it for nouns
    const combinedText = documents.map(doc => `${doc.question} ${doc.answer}`).join(" ");

    res.status(200).json({ text: combinedText });
  } catch (err) {
    res.status(500).json({ error: "The archive is silent." });
  }
}
