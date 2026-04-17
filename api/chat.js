export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userQuestion = body?.question || "";

    let archiveMemory = "";

    // 1. Fetch from Astra
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`;
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 20 } } })
      });
      const astraData = await astraRes.json();
      if (astraData?.data?.documents) {
        archiveMemory = astraData.data.documents.map(doc => doc.answer || "").join("\n\n");
      }
    } catch (e) { console.error("Astra error:", e); }

    // 2. Generate the Answer
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are the Red Bot. Answer in the poetic, somber style of Nick Cave. Use this archive: " + archiveMemory.substring(0, 5000) },
          { role: "user", content: userQuestion }
        ]
      })
    });
    const data = await groqResponse.json();
    const aiAnswer = data?.choices?.[0]?.message?.content || "The AI is silent.";

    // 3. Generate a Visual Theme (STRICT VERSION)
    const themeRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: `Provide ONLY 3 descriptive words for an artistic photograph based on this question: "${userQuestion}". No conversation, just the words.` }]
      })
    });
    const themeData = await themeRes.json();
    const theme = themeData?.choices?.[0]?.message?.content?.replace(/[^a-zA-Z ]/g, "") || "solitude";

    res.status(200).json({ 
        answer: aiAnswer, 
        imagePrompt: `A grainy vintage melancholic polaroid of ${theme}, muted colors, artistic lighting`
    });

  } catch (err) {
    res.status(200).json({ answer: "System Error: " + err.message });
  }
}
