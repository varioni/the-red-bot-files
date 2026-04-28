import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
  
  const { question, answer, noun, seed } = req.body;
  const id = uuidv4();

  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
    await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "insertOne": {
          "document": {
            "_id": id,
            "question": question,
            "answer": answer,
            "noun": noun,
            "seed": seed,
            "created_at": new Date().toISOString()
          }
        }
      })
    });
    res.status(200).json({ id });
  } catch (e) {
    res.status(500).json({ error: "Failed to save log" });
  }
}
