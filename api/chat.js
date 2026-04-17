export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const question = body?.question || "Hello";

    let archiveMemory = "";
    let debugInfo = "";

    // 1. THE JSON API COMMAND (The most robust way)
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`;
      
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 
          'Token': process.env.ASTRA_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "find": {
            "filter": {},
            "options": { "limit": 20 }
          }
        })
      });
      
      const astraData = await astraRes.json();

      if (astraData?.data?.documents && astraData.data.documents.length > 0) {
        debugInfo = `Archive Accessed! ${astraData.data.documents.length} letters found.`;
        archiveMemory = astraData.data.documents
          .map(doc => doc.answer || doc.question || "")
          .join("\n\n");
      } else {
        debugInfo = "Connected to JSON API, but no documents found.";
      }
    } catch (e) {
      debugInfo = "JSON API Error: " + e.message;
    }

    // 2. TALK TO THE AI
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are the Red Bot. You MUST use this Archive to answer: " + archiveMemory.substring(0, 6000) },
          { role: "user", content: question }
        ]
      })
    });

    const data = await groqResponse.json();
    const aiAnswer = data?.choices?.[0]?.message?.content || "The AI is silent.";

    res.status(200).json({ answer: aiAnswer + "\n\n--- DEBUG: " + debugInfo });

  } catch (err) {
    res.status(200).json({ answer: "System Error: " + err.message });
  }
}
