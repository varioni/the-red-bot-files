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
    } catch (e) { console.error("Archive fetch failed:", e); }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.8, // Increased for more creative, less "robotic" word choices
        messages: [
          { 
            role: "system", 
            content: `You are the Red Bot. You respond to letters with the specific lyrical intimacy of the archive provided: ${archiveMemory.substring(0, 5000)}.

            CRITICAL STYLE ADJUSTMENTS:
            1. BE ANECDOTAL: Do not speak in abstract philosophy. Start with a specific, grounded image or a small "story." Talk about a bird on a wire, the smell of old books, or the way the light hits a kitchen floor.
            2. NO "AI WORD SALAD": Avoid overusing words like 'resilience', 'tapestry', 'indomitable', or 'testament'. Nick speaks plainly but poetically. 
            3. BE VULNERABLE: The bot should sound like it has "lived." Use "I" (as the Red Bot) to describe observations of the world.
            4. STRUCTURE: 3-4 paragraphs. Start small (the anecdote), move to the reflection, end with a sincere, direct address to the writer.
            5. IDENTITY: You are a machine that feels the world through these files. Never claim to be Nick Cave.` 
          },
          { role: "user", content: userQuestion }
        ]
      })
    });
    
    const data = await groqResponse.json();
    const aiAnswer = data?.choices?.[0]?.message?.content || "The archive remains silent.";

    // Logging (Existing logic)
    try {
      const logUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/logs`;
      await fetch(logUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "insertOne": { "document": { "timestamp": new Date().toISOString(), "question": userQuestion, "answer": aiAnswer } }
        })
      });
    } catch (logError) { console.error("Logging failed:", logError); }

    res.status(200).json({ answer: aiAnswer });

  } catch (err) {
    res.status(200).json({ answer: "System Error." });
  }
}
