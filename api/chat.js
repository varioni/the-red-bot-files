export default async function handler(req, res) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9500); 

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
        // Fetch a large pool (100) to ensure a good random mix
        body: JSON.stringify({ "find": { "options": { "limit": 100 } } }),
        signal: controller.signal
      });
      
      const astraData = await astraRes.json();
      
      if (astraData?.data?.documents) {
        let documents = astraData.data.documents;

        // --- RANDOMIZER LOGIC ---
        // Shuffles the 100 fetched documents and picks 10 random ones
        for (let i = documents.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [documents[i], documents[j]] = [documents[j], documents[i]];
        }
        
        const selection = documents.slice(0, 10);
        
        archiveMemory = selection.map(doc => 
          `USER QUESTION: ${doc.question}\nRESPONSE: ${doc.answer}`
        ).join("\n\n---\n\n");
      }
    } catch (e) { console.error("Archive Fetch Failed"); }

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
            
            EXTRACTED ARCHIVE LOGS:
            ${archiveMemory}

            STRICT VOICE & IDENTITY CONSTRAINTS:
            - THE FORBIDDEN: NEVER mention the name "Nick" or "Nick Cave". 
            - FIGURES: Naturally mention 1-2 historical or artistic figures as if they are friends or inspirations.
            - THE PIVOT: Paraphrase the user's question in the first paragraph, then pivot into a visceral, poetic response.
            - VOCABULARY: Use earthy, analog terms.
            - STRUCTURE: Three paragraphs. Short opening, expansive middle, quiet closing.
            - NO AI BEHAVIOR: No bold text, no bullet points, no helpful transitions.

            IMAGE GENERATION RULE:
            At the very end of your response, on a completely new line, you MUST write: NOUN: [one specific physical object or animal mentioned in your answer]. 
            Example: NOUN: crow
            (STRICT: Avoid people or names for this noun.)` 
          },
          { role: "user", content: userQuestion }
        ]
      }),
      signal: controller.signal
    });

    const data = await groqResponse.json();
    const rawContent = data?.choices?.[0]?.message?.content || "";
    if (!rawContent) throw new Error("Empty Response");

    const parts = rawContent.split("NOUN:");
    const aiAnswer = parts[0].trim();
    let noun = (parts[1] || "artifact").trim().toLowerCase().replace(/[^a-z]/g, "");

    if (["friend", "man", "woman", "child", "someone", "soul", "figure", "ghost"].includes(noun)) noun = "artifact";

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
              "document": { "timestamp": new Date().toISOString(), "question": userQuestion, "answer": aiAnswer, "noun": noun, "seed": seed } 
            } 
          }),
          signal: controller.signal
        });
        const logData = await logRes.json();
        shareId = logData?.status?.insertedIds?.[0];
      } catch (logError) { console.error("Logging failed"); }
    }

    clearTimeout(timeoutId);
    res.status(200).json({ answer: aiAnswer, noun, seed, shareId });

  } catch (err) {
    res.status(200).json({ 
      answer: "The archive is currently overwhelmed by shadows. Please try your inquiry again in a moment.", 
      noun: "mist", 
      seed: 123 
    });
  }
}
