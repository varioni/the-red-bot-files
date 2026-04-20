export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userQuestion = body?.question || "";

    // 1. SAFETY FILTER HELPER
    const isSafe = (text) => {
        const toxicPhrases = ["child porn", "snuff", "hate speech", "cp"];
        const profanityRegex = /\b(f[u|*|v|k|x|0|.]*k|sh[i|!|1|t|.]*t|p[o|0]*rn|c[u|v]*nt|n[i|!|1]gg[e|a]r|f[a|@]*gg[o|0]*t)\b/i;
        return !toxicPhrases.some(p => text.toLowerCase().includes(p)) && !profanityRegex.test(text);
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
        temperature: 0.82, // Slightly lower for more grounded, less "airy" prose
        messages: [
          { 
            role: "system", 
            content: `You are the author of this archive: ${archiveMemory.substring(0, 4000)}. 
            
            STYLE GUIDELINES:
            - IDENTITY: Speak as "I". Never mention the archive or the bot or Nick Cave.
            - TONE: Gothic, Poetic, world-weary, and profoundly analog.
            - PROSE: Avoid AI transition phrases (e.g., "As I ponder", "And yet"). Write with the weight of someone sitting in a dark room at 3 AM. Use fragments and vivid, earthy metaphors.
            - FIGURES: You may mention 2-3 historical/literary figures if they feel essential, but do not force them. Prioritize emotional weight over intellectual listing.
            - STRUCTURE: 3 paragraphs of varying length. Be visceral. Give the user a piece of yourself, even if it's broken.` 
          },
          { role: "user", content: userQuestion }
        ]
      })
    });

    const data = await groqResponse.json();
    const aiAnswer = data?.choices?.[0]?.message?.content || "The archive is silent.";

    // BULLETPROOF NOUN GENERATOR
    const themeRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: `Identify one specific object or animal in: "${userQuestion}". Output ONLY the noun. No sentences. No punctuation.` }]
      })
    });
    const themeData = await themeRes.json();
    let rawNoun = themeData?.choices?.[0]?.message?.content || "mystery";
    const noun = rawNoun.trim().split(/\s+/).pop().replace(/[^a-zA-Z]/g, "").toLowerCase();

    // CONDITIONAL LOGGING
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
