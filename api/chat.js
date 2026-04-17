export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const question = body?.question || "Hello";

    let archiveMemory = "";
    let debugInfo = "";

    // 1. DIRECT DOCUMENT ACCESS (The Master Key)
    try {
      // We are switching to the 'documents' path which is more reliable for simple retrieval
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives?page-size=20`;
      
      const astraRes = await fetch(astraUrl, {
        headers: { 'X-Cassandra-Token': process.env.ASTRA_TOKEN }
      });
      
      const astraData = await astraRes.json();

      // Astra Documents API returns data inside 'data' as an object of objects
      if (astraData && astraData.data) {
        const rows = Object.values(astraData.data);
        if (rows.length > 0) {
          debugInfo = "Master Key Success! Found " + rows.length + " letters.";
          archiveMemory = rows.map(r => r.answer || "").join("\n\n");
        } else {
          debugInfo = "Archive is empty on the Document level.";
        }
      } else {
        debugInfo = "Astra returned an unexpected format: " + JSON.stringify(astraData).substring(0, 100);
      }
    } catch (e) {
      debugInfo = "Astra Connection Failed: " + e.message;
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
          { role: "system", content: "You are the Red Bot. You MUST use the following context to answer. If the context mentions 'July 2025', quote it exactly. CONTEXT: " + archiveMemory.substring(0, 5000) },
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
