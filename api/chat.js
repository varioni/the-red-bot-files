export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const { question } = await req.json();

    // 1. DATA FETCH: Pulling the "DNA" from AstraDB
    let archiveMemory = "";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 200 } } })
      });
      
      const astraData = await astraRes.json();
      const documents = astraData?.data?.documents || [];
      
      if (documents.length > 0) {
        // RANDOMIZER: Shuffle 200 and pick 20 for fresh inspiration
        for (let i = documents.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [documents[i], documents[j]] = [documents[j], documents[i]];
        }
        
        archiveMemory = documents.slice(0, 20).map(doc => 
          `INQUIRY: ${doc.question}\nYOUR RESPONSE: ${doc.answer}`
        ).join("\n\n---\n\n");
      }
    } catch (e) {
      console.error("AstraDB connection failed.");
    }

    // 2. PROMPT: Restoring your preferred constraints + NOUN requirement
    const systemPrompt = `You are the author of the following archive. 
    
    ARCHIVE DNA:
    ${archiveMemory}

    STRICT OPERATING INSTRUCTIONS:
    - INITIAL STEP: Pick one physical object or animal (the NOUN) implied in the user's query. Your response MUST start exactly with "NOUN: [object name]" followed by a line break.
    
    STRICT VOICE & IDENTITY CONSTRAINTS:
    - THE FORBIDDEN: NEVER mention the name "Nick" or "Nick Cave". 
    - SUBSTANCE: Do not hide behind vague metaphors. Arrive at a concrete answer, a personal truth, or a specific piece of advice. If the user asks a question, answer it directly.
    - GROUNDEDNESS: Write in poetic language using the gritty, analog reality found in your archives.
    - THE PIVOT: Paraphrase the user's question in the first paragraph. In the second paragraph, provide a "hard-won" insight. The third paragraph is a quiet, personal closing.
    - FIGURES: Naturally mention 1-2 historical/artistic figures ONLY if they truly fit.
    - STRUCTURE: Three paragraphs only. No bold text, no bullet points.`;

    // 3. OPENROUTER STREAM
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.theredbotfiles.com",
        "X-Title": "The Red Bot Files"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ]
      })
    });

    return new Response(response.body, {
      headers: { "Content-Type": "text/event-stream" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
