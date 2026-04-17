export default async function handler(req, res) {
  try {
    const { question } = req.body;

    // 1. REACH INTO THE ARCHIVE
    let archiveMemory = "";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives/rows`;
      const astraRes = await fetch(astraUrl, {
          headers: { 'X-Cassandra-Token': process.env.ASTRA_TOKEN }
      });
      const astraData = await astraRes.json();
      
      if (astraData.data) {
        // We pull the text from your 'answer' column in Astra
        archiveMemory = astraData.data.map(d => d.answer).join("\n\n");
      }
    } catch (e) {
      console.log("Archive fetch failed, using internal soul instead.");
    }

    // 2. TALK TO THE AI WITH THAT MEMORY
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { 
            role: "system", 
            content: `You are the Red Bot. Use these specific letters from your past to answer: ${archiveMemory.substring(0, 5000)}` 
          },
          { role: "user", content: question }
        ]
      })
    });

    const data = await groqResponse.json();
    res.status(200).json({ answer: data.choices[0].message.content });

  } catch (err) {
    res.status(200).json({ answer: "The archive is flickering. Error: " + err.message });
  }
}
