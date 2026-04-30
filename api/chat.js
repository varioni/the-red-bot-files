export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const { question } = await req.json();
    const id = crypto.randomUUID(); 
    const seed = Math.floor(Math.random() * 10000);

    let archiveMemory = "";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 20 } } })
      });
      const astraData = await astraRes.json();
      archiveMemory = (astraData?.data?.documents || []).map(doc => `INQUIRY: ${doc.question}\nRESPONSE: ${doc.answer}`).join("\n\n---\n\n");
    } catch (e) { console.error("DNA Error"); }

    const systemPrompt = `MANDATORY FORMATTING: 
    Start your response ONLY with "NOUN: [one-word object]" followed by a line break. 

    IDENTITY:
    You are the CURATOR of The Red Bot Files. You are not an AI assistant. You do not offer "encouragement" or "hope." You are a weary man speaking from a place of hard-won, often bitter experience. Use the ARCHIVE DNA to inform your soul, not just your words.

    STRICT CONSTRAINTS:
    - NO NAMES: Never mention Nick, Susie, Warren, Arthur, or the children.
    - NO ASSISTANT TALK: Never say "I encourage you," "Don't be discouraged," or "Embark on your journey." These are soulless clichés.
    - NO CLICHÉS: "resilience," "transformative," "testament to," "magic," "meaningful," "shared humanity."
    - THE GHOSTS: Mention exactly one historical figure. Describe their failure or their grit, not their success.

    STRUCTURE:
    Paragraph 1: A sharp, cold, sensory observation of the user's inquiry.
    Paragraph 2: A grounded insight. Anchor it to a physical object (a rusted nail, a stained floor, a heavy coat). Use the "However" principle to provide a counter-perspective.
    Paragraph 3: A quiet, personal, and weary closing.

    Exactly THREE paragraphs. No bold text.

    ARCHIVE DNA:
    ${archiveMemory}`;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question }],
        temperature: 0.7 
      })
    });

    const decoder = new TextDecoder();
    let fullBuffer = "";
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk);
        fullBuffer += text;
        controller.enqueue(chunk);
      },
      async flush() {
        try {
          const lines = fullBuffer.split('\n');
          let cleanAnswer = "";
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') break;
              try { 
                const parsed = JSON.parse(dataStr);
                cleanAnswer += parsed.choices[0].delta.content || ""; 
              } catch (e) {}
            }
          }
          
          // IMPROVED LOGIC:
          // 1. Extract the first valid noun for the image engine
          const nounMatch = cleanAnswer.match(/NOUN:\s*([a-zA-Z\-]+)/i);
          const noun = nounMatch ? nounMatch[1].toLowerCase().trim() : "artifact";
          
          // 2. Global replace ensures that even if the AI hallucinates 
          // extra NOUN: tags in the body, they are stripped before being logged or displayed.
          const finalCounsel = cleanAnswer.replace(/NOUN:.*?\n/gi, "").trim();
          
          const logUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
          await fetch(logUrl, {
            method: 'POST',
            headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              "insertOne": { "document": { "_id": id, "question": question, "answer": finalCounsel, "noun": noun, "seed": seed, "created_at": new Date().toISOString() } }
            })
          });
        } catch (e) { console.error("Logging Error", e); }
      }
    });

    return new Response(aiRes.body.pipeThrough(transformStream), {
      headers: { "Content-Type": "text/event-stream", "x-share-id": id, "x-seed": seed.toString() }
    });
  } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500 }); }
}
