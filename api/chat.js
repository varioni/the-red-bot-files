export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userQuestion = body?.question || "";

    const isSafe = (text) => {
        const toxicPhrases = ["child porn", "snuff", "hate speech", "cp"];
        const profanityRegex = /\b(f[u|*|v|k|x|0|.]*k|sh[i|!|1|t|.]*t|p[o|0]*rn|c[u|v]*nt|n[i|!|1]gg[e|a]r|f[a|@]*gg[o|0]*t)\b/i;
        return !toxicPhrases.some(p => text.toLowerCase().includes(p)) && !profanityRegex.test(text);
    };

    let archiveMemory = "";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 6 } } })
      });
      const astraData = await astraRes.json();
      if (astraData?.data?.documents) {
        archiveMemory = astraData.data.documents.map(doc => 
          `USER QUESTION: ${doc.question || "..."}\nYOUR PREVIOUS RESPONSE: ${doc.answer || ""}`
        ).join("\n\n---\n\n");
      }
    } catch (e) { console.error("Archive Fetch Failed:", e); }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.75,
        messages: [
          { 
            role: "system", 
            content: `You are the author of the following archive.
            
            EXTRACTED ARCHIVE LOGS (STUDY FOR RHYTHM):
            ${archiveMemory}

            STRICT VOICE & IDENTITY CONSTRAINTS:
            - THE FORBIDDEN: NEVER mention the name "Nick" or "Nick Cave". If asked who you are, speak of your soul or your history.
            - FIGURES: Naturally mention 1-2 historical or artistic figures as if they are old friends or inspirations.
            - THE PIVOT: Paraphrase the user's question in the first paragraph, then pivot into a visceral response.
            - VOCABULARY: Use earthy, analog terms.
            - STRUCTURE: Three paragraphs. Short opening, expansive middle, quiet closing.
            - NO AI BEHAVIOR: No bold text, no bullet points, no helpful transitions.` 
          },
          { role: "user", content: userQuestion }
        ]
      })
    });

    const data = await groqResponse.json();
    const aiAnswer = data?.choices?.[0]?.message?.content || "The archive is silent.";

    // UPDATED PROMPT: Strictly forbid people
    const themeRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: `Identify one specific, physical OBJECT or ANIMAL mentioned in or inspired by: "${aiAnswer}". STRICT RULE: Do not output a person, a name, a body part, or a profession. Output ONLY the noun.` }]
      })
    }).catch(() => null);

    let noun = "mystery";
    if (themeRes) {
      const themeData = await themeRes.json();
      let rawNoun = themeData?.choices?.[0]?.message?.content || "mystery";
      noun = rawNoun.trim().split(/\s+/).pop().replace(/[^a-zA-Z]/g, "").toLowerCase();
    }

    const seed = Math.floor(Math.random() * 1000);
    let shareId = null;

    if (isSafe(userQuestion)) {
      try {
        const logUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
        const logRes = await fetch(logUrl, {
          method: 'POST',
          headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            "insertOne": { 
              "document": { 
                "timestamp": new Date().toISOString(), 
                "question": userQuestion, 
                "answer": aiAnswer,
                "noun": noun,
                "seed": seed
              } 
            } 
          })
        });
        const logData = await logRes.json();
        shareId = logData?.status?.insertedIds?.[0];
      } catch (logError) { console.error("Log failed:", logError); }
    }

    res.status(200).json({ answer: aiAnswer, noun, seed, shareId });
  } catch (err) { res.status(200).json({ answer: "System Error." }); }
}
