export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userQuestion = body?.question || "";

    let archiveMemory = "";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`;
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 20 } } })
      });
      const astraData = await astraRes.json();
      if (astraData?.data?.documents) {
        archiveMemory = astraData.data.documents.map(doc => doc.answer || "").join("\n\n");
      }
    } catch (e) { console.error("Astra error:", e); }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.8,
        messages: [
          { 
            role: "system", 
            content: `You are the Red Bot. Answer with anecdotal, poetic prose in 3 paragraphs. Focus on small physical details. You are a digital vessel.` 
          },
          { role: "user", content: userQuestion }
        ]
      })
    });
    const data = await groqResponse.json();
    const aiAnswer = data?.choices?.[0]?.message?.content || "The archive is silent.";

    // THE THEME GENERATOR - ADDING RANDOMNESS
    const themeRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: `Identify the main physical object in: "${userQuestion}". Output ONE noun only.` }]
      })
    });
    const themeData = await themeRes.json();
    const noun = themeData?.choices?.[0]?.message?.content?.replace(/[^a-zA-Z]/g, "").trim().toLowerCase() || "object";
    
    // Salt the theme to bypass Unsplash rate-limiting/blocking
    const finalTheme = `${noun}-${Math.floor(Math.random() * 1000)}`;

    // LOGGING
    try {
      const logUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/logs`;
      await fetch(logUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "insertOne": {
            "document": {
              "timestamp": new Date().toISOString(),
              "question": userQuestion,
              "answer": aiAnswer
            }
          }
        })
      });
    } catch (logError) { console.error("Log failed:", logError); }

    res.status(200).json({ answer: aiAnswer, imageTheme: finalTheme });

  } catch (err) {
    res.status(200).json({ answer: "System Error." });
  }
}
