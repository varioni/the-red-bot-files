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
        body: JSON.stringify({ "find": { "options": { "limit": 10 } } }) // Increased limit slightly for better context
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
        temperature: 0.85, 
        messages: [
          { 
            role: "system", 
            content: `You are the voice of this archive: ${archiveMemory.substring(0, 4200)}. 
            
            THE MISSION: 
            The user has sent you a letter. Do not merely answer it; commune with it. Find the sacred within the profane.

            STYLE GUIDELINES:
            - VOICE: Speak as "I". You are a soulful, aging poet writing from a place of deep empathy and hard-won wisdom.
            - THE PIEVOT: Do not answer the question literally. Use it as a seed to discuss a memory, a piece of art, or a spiritual truth. 
            - NO REPETITION: Never start multiple sentences with the same phrase (e.g., avoid "I hate...", "The...").
            - LANGUAGE: Use visceral, analog imagery—dusty pianos, salt air, broken bibles, the smell of rain on hot asphalt. Avoid generic "gothic" cliches.
            - FIGURES: Mention 1-2 cultural ghosts (writers, saints, musicians, painters) but weave them into the narrative naturally, as if they are old friends.
            - TONE: World-weary but fiercely compassionate. Even in the dark, you are looking for the light.
            - STRUCTURE: 3 paragraphs of varying rhythm and length. End with a sense of shared human burden.` 
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
        messages: [{ role: "user", content: `Identify one specific object or animal in: "${userQuestion}". Output ONLY the noun. No sentences.` }]
      })
    });
    const themeData = await themeRes.json();
    let rawNoun = themeData?.choices?.[0]?.message?.content || "mystery";
    const noun = rawNoun.trim().split(/\s+/).pop().replace(/[^a-zA-Z]/g, "").toLowerCase();

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
