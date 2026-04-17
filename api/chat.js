export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const question = body?.question || "Hello";

    let archiveMemory = "";
    let debugInfo = "";

    // 1. PULL FROM THE VECTOR TABLE
    try {
      // We use the rows API but fetch more results to be sure
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives/rows?page-size=50`;
      
      const astraRes = await fetch(astraUrl, {
        headers: { 'X-Cassandra-Token': process.env.ASTRA_TOKEN }
      });
      
      const astraData = await astraRes.json();

      if (astraData && astraData.data && astraData.data.length > 0) {
        debugInfo = "Success! Found " + astraData.data.length + " letters in the Vector Table.";
        // We join the 'answer' column content
        archiveMemory = astraData.data
          .map(row => row.answer || row.question || "")
          .filter(text => text.length > 0)
          .join("\n\n---\n\n");
      } else {
        debugInfo = "Connected to Vector Table, but it returned 0 rows.";
      }
    } catch (e) {
      debugInfo = "Astra Table Fetch Failed: " + e.message;
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
          { 
            role: "system", 
            content: "You are the Red Bot. You MUST use the provided archive to answer. Mention the specific Issue # if you see it. ARCHIVE: " + archiveMemory.substring(0, 6000) 
          },
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
