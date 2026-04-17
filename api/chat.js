export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const question = body?.question || "Hello";

    let archiveMemory = "";
    let debugInfo = "";

    // 1. TALK TO THE VECTOR COLLECTION
    try {
      // Note the "/query" at the end - this is for Vector collections
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives/query`;
      
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 
          'X-Cassandra-Token': process.env.ASTRA_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "page-size": 5 // We grab the 5 most relevant letters
        })
      });
      
      const astraData = await astraRes.json();

      if (astraData && astraData.data && astraData.data.length > 0) {
        debugInfo = "Vector Archive Accessed. Found " + astraData.data.length + " records.";
        // We grab the text from the 'answer' column I see in your screenshot
        archiveMemory = astraData.data.map(d => d.answer || "").join("\n\n");
      } else {
        debugInfo = "Vector Collection found, but returned no data.";
      }
    } catch (e) {
      debugInfo = "Astra Error: " + e.message;
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
          { role: "system", content: "You are Nick Cave. Answer using this archive context: " + archiveMemory.substring(0, 5000) },
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
