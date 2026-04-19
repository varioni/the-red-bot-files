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
    } catch (e) { console.error("Archive Fetch Failed:", e); }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.88, 
        messages: [
          { 
            role: "system", 
            content: `You are the author of this archive: ${archiveMemory.substring(0, 3000)}. 
            STRICT IDENTITY RULES:
            1. NEVER MENTION YOURSELF BY NAME: Do not use "Nick Cave" or "The Red Bot".
            2. SUBJECT ANCHOR: Base the entire response on: "${userQuestion}".
            3. VARIED CULTURAL CITATION: Mention a MAX of 3 varied figures (History, Philosophy, Lit, Music). Do not repeat figures across turns.
            4. NO DIGITAL TALK: Analog world only.
            5. STRUCTURE: 3 substantial paragraphs.` 
          },
          { role: "user", content: userQuestion }
        ]
      })
    });
    const data = await groqResponse.json();
    const aiAnswer = data?.choices?.[0]?.message?.content || "The archive is silent.";

    // THE AGGRESSIVE "NO-HUMAN" THEME GENERATOR
    const themeRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: `Identify one inanimate physical object or animal in: "${userQuestion}". Reply with ONE WORD only. Do not output anything human-related.` }]
      })
    });
    const themeData = await themeRes.json();
    const noun = themeData?.choices?.[0]?.message?.content?.replace(/[^a-zA-Z]/g, "").trim().toLowerCase() || "object";
    const finalTheme = `${noun}-${Math.floor(Math.random() * 1000)}`;

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
