export default async function handler(req, res) {
  try {
    // 1. Get the question from the body (with a fallback)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userQuestion = body?.question || "Hello"; 

    // 2. Fetch from Astra
    let archiveMemory = "You are Nick Cave.";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives/rows`;
      const astraRes = await fetch(astraUrl, {
          headers: { 'X-Cassandra-Token': process.env.ASTRA_TOKEN }
      });
      const astraData = await astraRes.json();
      if (astraData?.data) {
        archiveMemory = astraData.data.map(d => d.answer || d.question || d.content || "").join("\n\n");
      }
    } catch (e) {
      console.log("Astra skipped");
    }

    // 3. Talk to Groq - using 'userQuestion' correctly
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are the Red Bot, an AI Nick Cave. Context: " + archiveMemory.substring(0, 4000) },
          { role: "user", content: String(userQuestion) } // Force it to be a string
        ]
      })
    });

    const data = await groqResponse.json();

    if (data?.choices?.[0]?.message?.content) {
      res.status(200).json({ answer: data.choices[0].message.content });
    } else {
      res.status(200).json({ answer: "The AI is thinking in silence. " + JSON.stringify(data) });
    }

  } catch (err) {
    res.status(200).json({ answer: "System Error: " + err.message });
  }
}
