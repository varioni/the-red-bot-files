export default async function handler(req, res) {
  try {
    const { question } = req.body || {};
    if (!question) return res.status(200).json({ answer: "I am waiting for your words." });

    let archiveMemory = "";
    let debugInfo = "Astra connection attempted.";

    // 1. THE RUGGED ASTRA FETCH
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives/rows`;
      const astraRes = await fetch(astraUrl, {
          headers: { 'X-Cassandra-Token': process.env.ASTRA_TOKEN },
          method: 'GET'
      });
      
      const astraData = await astraRes.json();
      
      if (astraData && astraData.data && astraData.data.length > 0) {
        debugInfo = "Success! Columns found: " + Object.keys(astraData.data[0]).join(", ");
        archiveMemory = astraData.data.map(d => d.answer || d.question || d.content || d.body || "").join(" ");
      } else {
        debugInfo = "Connected, but the collection is empty.";
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
          { role: "system", content: "You are Nick Cave. If the following ARCHIVE has info, use it. Otherwise, be poetic. ARCHIVE: " + archiveMemory.substring(0, 4000) },
          { role: "user", content: question }
        ]
      })
    });

    const data = await groqResponse.json();

    // 3. SAFE RESPONSE
    const aiAnswer = data?.choices?.[0]?.message?.content || "The AI is silent.";
    res.status(200).json({ answer: aiAnswer + "\n\n--- DEBUG: " + debugInfo });

  } catch (err) {
    res.status(200).json({ answer: "System Error: " + err.message });
  }
}
