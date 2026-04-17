export default async function handler(req, res) {
  try {
    // 1. Get the question safely
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const question = body?.question || "Hello";

    let archiveMemory = "";
    let debugInfo = "Astra check in progress...";

    // 2. The Rugged Astra Fetch
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives/rows`;
      const astraRes = await fetch(astraUrl, {
        headers: { 'X-Cassandra-Token': process.env.ASTRA_TOKEN }
      });
      const astraData = await astraRes.json();

      if (astraData && astraData.data && astraData.data.length > 0) {
        const firstRow = astraData.data[0];
        debugInfo = "Success! Columns found: " + Object.keys(firstRow).join(", ");
        archiveMemory = astraData.data.map(d => d.answer || d.question || d.content || d.body || "").join(" ");
      } else {
        debugInfo = "Database connected, but no letters found. Did you upload the CSV?";
      }
    } catch (e) {
      debugInfo = "Astra Connection Failed: " + e.message;
    }

    // 3. Talk to Groq
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are Nick Cave. If there is ARCHIVE info, use it. ARCHIVE: " + archiveMemory.substring(0, 4000) },
          { role: "user", content: question }
        ]
      })
    });

    const data = await groqResponse.json();
    const aiAnswer = data?.choices?.[0]?.message?.content || "The AI is silent.";

    res.status(200).json({ answer: aiAnswer + "\n\n--- DEBUG: " + debugInfo });

  } catch (err) {
    // This catch block ensures we NEVER see a 'Reading 0' error again
    res.status(200).json({ answer: "The archive is flickering. Error: " + err.message });
  }
}
