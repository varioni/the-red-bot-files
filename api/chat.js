export default async function handler(req, res) {
  try {
    const { question } = req.body;
    const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives/rows`;
    
    const astraRes = await fetch(astraUrl, {
        headers: { 'X-Cassandra-Token': process.env.ASTRA_TOKEN }
    });
    const astraData = await astraRes.json();

    // 1. THIS IS THE KEY: We see what the columns are actually named
    let debugInfo = "";
    if (astraData.data && astraData.data[0]) {
        debugInfo = "I see these columns: " + Object.keys(astraData.data[0]).join(", ");
    } else {
        debugInfo = "The database is totally empty.";
    }

    // 2. Try to grab the text from ANY likely column name
    const archiveMemory = astraData.data ? astraData.data.map(d => 
        d.answer || d.content || d.text || d.body || d.column1 || ""
    ).join(" ") : "";

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are Nick Cave. ARCHIVE: " + archiveMemory.substring(0, 4000) },
          { role: "user", content: question }
        ]
      })
    });

    const data = await groqResponse.json();
    const aiAnswer = data.choices[0].message.content;

    // We add the debug info to the bottom so you can see it!
    res.status(200).json({ answer: aiAnswer + "\n\n--- DEBUG: " + debugInfo });

  } catch (err) {
    res.status(200).json({ answer: "System Error: " + err.message });
  }
}
