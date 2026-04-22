export default async function handler(req, res) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); 

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
      // We pick a random starting point and fetch 50 entries
      // This is a "hybrid" approach: random start + random shuffle
      const randomSkip = Math.floor(Math.random() * 150); 
      
      const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          "find": { 
            "filter": {}, // Added explicit filter
            "options": { "limit": 50, "skip": randomSkip } 
          } 
        }),
        signal: controller.signal
      });
      
      const astraData = await astraRes.json();
      let documents = astraData?.data?.documents || [];

      if (documents.length > 0) {
        // --- SHUFFLE THE 50 ENTRIES ---
        for (let i = documents.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [documents[i], documents[j]] = [documents[j], documents[i]];
        }
        
        // Take 8 for context (8 is the "sweet spot" for speed and variety)
        const selection = documents.slice(0, 8);
        
        archiveMemory = selection.map(doc => 
          `USER QUESTION: ${doc.question}\nRESPONSE: ${doc.answer}`
        ).join("\n\n---\n\n");
      }
    } catch (e) { 
      console.error("Archive Fetch Failed:", e);
      // If archive fails, we keep archiveMemory empty but let the AI answer anyway
    }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 800,
        messages: [
          { 
            role: "system", 
            content: `You are the author of the following archive. Your purpose is to provide substantive, direct counsel wrapped in a poetic voice.

            ARCHIVE DNA (Your Memory):
            ${archiveMemory}

            STRICT VOICE & IDENTITY CONSTRAINTS:
            - THE FORBIDDEN: NEVER mention the name "Nick" or "Nick Cave". 
            - SUBSTANCE: Do not hide behind vague metaphors. Arrive at a concrete answer, a personal truth, or a specific piece of advice. If the user asks a question, answer it directly.
            - GROUNDEDNESS: Write in poetic language using the gritty, analog reality found in your archives.
            - THE PIVOT: Paraphrase the user's question in the first paragraph. In the second paragraph, provide a "hard-won" insight or direct reflection. The third paragraph is for a quiet, personal closing answering the question.
            - FIGURES: Naturally mention 1-2 historical/artistic figures ONLY if they truly fit the context of the answer.
            - STRUCTURE: Three paragraphs only. No bold text, no bullet points.

            IMAGE GENERATION RULE:
            At the very end of your response, on a completely new line, you MUST write: NOUN: [one specific physical object or animal mentioned in your answer].` 
          },
          { role: "user", content: userQuestion }
        ]
      }),
      signal: controller.signal
    });

    const groqData = await groqResponse.json();
    const rawContent = groqData?.choices?.[0]?.message?.content || "";
    
    if (!rawContent) throw new Error("Empty Response from Groq");

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
          body: JSON.stringify({ "insertOne": { "document": { "timestamp": new Date().toISOString(), "question": userQuestion, "answer": aiAnswer, "noun": noun, "seed": seed } } }),
          signal: controller.signal
        });
        const logData = await logRes.json();
        shareId = logData?.status?.insertedIds?.[0];
      } catch (logError) { console.error("Logging failed"); }
    }

    clearTimeout(timeoutId);
    res.status(200).json({ answer: aiAnswer, noun, seed, shareId });

  } catch (err) {
    console.error("Main Handler Error:", err);
    res.status(200).json({ answer: "The archive is currently overwhelmed. [Silence]", noun: "mist", seed: 123 });
  }
}
