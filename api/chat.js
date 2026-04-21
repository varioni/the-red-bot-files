export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userQuestion = body?.question || "";

    // 1. TEST ASTRA CONNECTION
    let archiveMemory = "";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 2 } } })
      });
      const astraData = await astraRes.json();
      if (astraData?.data?.documents) {
        archiveMemory = "Astra Connected.";
      }
    } catch (e) { 
      return res.status(200).json({ answer: "DEBUG ERROR: Astra DB connection failed. Check your ASTRA_TOKEN." });
    }

    // 2. TEST GROQ CONNECTION
    let aiAnswer = "";
    try {
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant", // Using a smaller model for faster testing
          messages: [{ role: "user", content: "Say 'Hello'." }]
        })
      });
      const groqData = await groqResponse.json();
      if (!groqData.choices) {
        return res.status(200).json({ answer: `DEBUG ERROR: Groq API rejected the key. Error: ${JSON.stringify(groqData.error)}` });
      }
      aiAnswer = "Groq Connected.";
    } catch (e) {
      return res.status(200).json({ answer: "DEBUG ERROR: Groq connection timed out or was blocked by Vercel." });
    }

    res.status(200).json({ answer: "Success! Both services are talking. If you see this, we can move back to the full Nick Cave prompt.", noun: "key", seed: 1 });

  } catch (err) {
    res.status(200).json({ answer: `DEBUG CRITICAL: ${err.message}` });
  }
}
