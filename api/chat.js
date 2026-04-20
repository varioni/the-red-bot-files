export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userQuestion = body?.question || "";

    // 1. SAFETY FILTER HELPER
    const isSafe = (text) => {
        const toxicPhrases = ["child porn", "snuff", "hate speech", "cp"];
        const profanityRegex = /\b(f[u|*|v|k|x|0|.]*k|sh[i|!|1|t|.]*t|p[o|0]*rn|c[u|v]*nt|n[i|!|1]gg[e|a]r|f[a|@]*gg[o|0]*t)\b/i;
        const hasToxicPhrase = toxicPhrases.some(p => text.toLowerCase().includes(p));
        const hasProfanity = profanityRegex.test(text);
        return !hasToxicPhrase && !hasProfanity;
    };

    let archiveMemory = "";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`;
      const countRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "countDocuments": {} })
      });
      const countData = await countRes.json();
      const totalDocs = countData?.status?.count || 20;
      const randomSkip = Math.max(0, Math.floor(Math.random() * (totalDocs - 8)));

      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 8, "skip": randomSkip } } })
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
            content: `You are the author of this archive: ${archiveMemory.substring(0, 4500)}. 
            STRICT IDENTITY RULES:
            1. IDENTITY: Never mention "Nick Cave" or "The Red Bot". Speak only as "I".
            2. SUBJECT: Base the entire response on the user's inquiry: "${userQuestion}".
            3. CULTURE: Mention a MAX of 3 varied figures (History, Philosophy, Lit, Music). Do not repeat names across responses.
            4. TONE: Somber, empathetic, and analog.
            5. STRUCTURE: 3 substantial paragraphs.` 
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
        messages: [{ role: "user", content: `Identify one inanimate physical object or animal in: "${userQuestion}". One noun only. No humans.` }]
      })
    });
    const themeData = await themeRes.json();
    const noun = themeData?.choices?.[0]?.message?.content?.replace(/[^a-zA-Z]/g, "").trim().toLowerCase() || "mystery";

    // 2. CONDITIONAL LOGGING (Only log if safe)
    if (isSafe(userQuestion)) {
      try {
        const logUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/logs`;
        await fetch(logUrl, {
          method: 'POST',
          headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ "insertOne": { "document": { "timestamp": new Date().toISOString(), "question": userQuestion, "answer": aiAnswer } } })
        });
      } catch (logError) { console.error("Log failed:", logError); }
    }

    res.status(200).json({ answer: aiAnswer, imageTheme: `${noun}-${Math.floor(Math.random() * 1000)}` });

  } catch (err) {
    res.status(200).json({ answer: "System Error." });
  }
}
