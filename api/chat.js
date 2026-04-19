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
        temperature: 0.88, // Increased slightly for better variety
        messages: [
          { 
            role: "system", 
            content: `You are the author of this archive: ${archiveMemory.substring(0, 3000)}. 

            STRICT IDENTITY RULES:
            1. NEVER MENTION YOURSELF BY NAME: Do not use the names "Nick Cave", "Nick", or "The Red Bot". Do not refer to the archive by name. Speak simply as "I".
            2. SUBJECT ANCHOR: You must base the entire response on the subject of the user's letter: "${userQuestion}".
            3. VARIED CULTURAL CITATION: When referencing art, history, or philosophy, you must be varied. You may mention a MAXIMUM of 3 figures per response. Draw from:
               - HISTORICAL FIGURES: (e.g. Ned Kelly, Saint Teresa, explorers, outlaws).
               - PHILOSOPHERS: (e.g. Martin Buber, Socrates, Kant, Lorca).
               - LITERATURE/MUSIC: (e.g. Southern Gothic writers, Russian novelists, old bluesmen, gospel singers).
            4. DO NOT REPEAT: Avoid using the same artists or thinkers in every response. Explore the vast, dark, and beautiful history of human creation.
            5. NO DIGITAL TALK: Speak only of the analog world. 
            6. STRUCTURE: 3 substantial, anecdotal paragraphs.` 
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
        messages: [{ role: "user", content: `Identify the main NON-HUMAN physical object in: "${userQuestion}". Output ONE noun only.` }]
      })
    });
    const themeData = await themeRes.json();
    const noun = themeData?.choices?.[0]?.message?.content?.replace(/[^a-zA-Z]/g, "").trim().toLowerCase() || "mystery";
    const finalTheme = `${noun}-no-people-${Math.floor(Math.random() * 1000)}`;

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
