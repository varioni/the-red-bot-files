export default async function handler(req, res) {
  try {
    const { question } = req.body;

    // 1. Fetching from Astra with a "Safety Net"
    let archiveMemory = "You are Nick Cave. Be poetic.";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives/rows`;
      const astraRes = await fetch(astraUrl, {
          headers: { 'X-Cassandra-Token': process.env.ASTRA_TOKEN }
      });
      const astraData = await astraRes.json();
      
      if (astraData && astraData.data && astraData.data.length > 0) {
        // This line is now a "Detective" - it looks for 'answer' OR 'question' OR 'content'
        archiveMemory = astraData.data.map(d => d.answer || d.question || d.content || "").join("\n\n");
      }
    } catch (e) {
      console.error("Astra Error:", e);
    }

    // 2. Talk to Groq
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are the Red Bot. Use this archive context: " + archiveMemory.substring(0, 4000) },
          { role: "user", content: question }
        ]
      })
    });

    const data = await groqResponse.json();

    // 3. The "Anti-Crash" Check
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      res.status(200).json({ answer: data.choices[0].message.content });
    } else {
      // If the AI is empty, this tells us WHY
      res.status(200).json({ answer: "The AI sent an empty reply. Error info: " + JSON.stringify(data) });
    }

  } catch (err) {
    res.status(200).json({ answer: "Final System Error: " + err.message });
  }
}
