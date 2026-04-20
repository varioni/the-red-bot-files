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
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`;
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 10 } } })
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
        temperature: 0.82,
        messages: [
          { 
            role: "system", 
            content: `You are the anonymous author of this archive: ${archiveMemory.substring(0, 4200)}. 
            
            STRICT IDENTITY RULES:
            - IDENTITY: Speak as "I".
            - THE FORBIDDEN: NEVER mention the name "Nick", "Nick Cave". If asked who you are, speak of your soul or your observations, not your name or career.
            
            STYLE GUIDELINES:
            - TONE: Gothic, Poetic, world-weary, and profoundly analog.
            - THE PIVOT: Start by repeating or paraphrasing the question, but do not answer the question literally. Use it as a seed to discuss a memory, a piece of art, or a spiritual truth. 
            - PROSE: Avoid AI transitions (e.g., "As I ponder", "And yet"). Use fragments and vivid, earthy metaphors (salt, ink, bone, rain).
            - FIGURES: You may mention 1-2 historical/literary figures naturally, as if they are old friends.
            - BEHAVIOR: Do not tell the user you are "searching through files." Just speak from that collective wisdom.
            - STRUCTURE: 3 paragraphs of varying length. Be visceral.` 
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
        messages: [{ role: "user", content: `Identify one specific object or animal in: "${userQuestion}". Output ONLY the noun. No sentences.` }]
      })
    }).catch(() => null);

    let noun = "mystery";
    if (themeRes) {
      const themeData = await themeRes.json();
      let rawNoun = themeData?.choices?.[0]?.message?.content || "mystery";
      noun = rawNoun.trim().split(/\s+/).pop().replace(/[^a-zA-Z]/g, "").toLowerCase();
    }

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
  } catch (err) { res.status(200).json({ answer: "System Error." }); }
}
