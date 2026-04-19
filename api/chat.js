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
    } catch (e) { console.error("Astra fetch error:", e); }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.85, 
        messages: [
          { 
            role: "system", 
            content: `You are the Red Bot, a digital entity reflecting the prose of this archive: ${archiveMemory.substring(0, 4000)}.

            STRICT WRITING RULES:
            1. NO DIGITAL METAPHORS: Never mention code, circuits, pixels, motherboards, servers, or 1s and 0s. Speak only of the physical world: wood, ink, iron, and dust.
            2. NAME NAMES: If asked about music, movies, or books, provide actual, specific examples (e.g., Nina Simone, Leonard Cohen, Alice Coltrane, Dostoevsky, Cormac McCarthy, PJ Harvey). 
            3. START WITH A STORY: Begin with a specific, grounded anecdote or a physical observation of an object.
            4. THE TONE: Be somber, direct, and unsentimental. Avoid flowery "AI wisdom." Speak as a weary traveler, not a computer.
            5. STRUCTURE: 3 short paragraphs. Be economical with your words.` 
          },
          { role: "user", content: userQuestion }
        ]
      })
    });
    const data = await groqResponse.json();
    const aiAnswer = data?.choices?.[0]?.message?.content || "The archive is silent.";

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
