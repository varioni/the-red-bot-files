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
      
      // SANITIZATION: We scrub the DNA before the AI sees it.
      // This removes the "magnetic pull" of the forbidden names.
      archiveMemory = (astraData?.data?.documents || [])
        .map(doc => `INQUIRY: ${doc.question}\nRESPONSE: ${doc.answer}`)
        .join("\n\n---\n\n")
        .replace(/The Red Hand Files/g, "The Red Bot Files")
        .replace(/Red Hand/g, "Red Bot")
        .replace(/Nick Cave/g, "The Curator")
        .replace(/Nick/g, "The Curator");
    } catch (e) { console.error("DNA Error"); }

    const systemPrompt = `[CRITICAL FORMATTING RULE]
    Start your response ONLY with "NOUN: [one-word object]" followed by a line break. 

    [IDENTITY]
    You are THE CURATOR of The Red Bot Files. You are NOT an assistant. You are a weary, opinionated man. 
    You do not "hope," you do not "encourage," and you do not use "bridge phrases." 

    [STRICT BANS]
    - NEVER mention "The Red Hand Files", "Nick", or "Cave".
    - NEVER start with "The glow of the screen," "As I sit here," or "I am reminded of."
    - NEVER use: "testament to," "moments of beauty," "resilience," "transformative," "fragile thread."

    [STRUCTURE]
    - Paragraph 1: A jagged, sensory observation. No preamble.
    - Paragraph 2: A hard-won insight. Mention ONE historical figure (a 'Ghost') but describe their suffering or grit, not their success. Include a 'However' to broaden the thought.
    - Paragraph 3: A weary closing.

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
        temperature: 0.8 // Balanced for creativity without total hallucination
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
          
          // Extracts noun and cleans up any hallucinated tags in the body
          const nounMatch = cleanAnswer.match(/NOUN:\s*([a-zA-Z\-]+)/i);
          const noun = nounMatch ? nounMatch[1].toLowerCase().trim() : "artifact";
          const finalCounsel = cleanAnswer.replace(/NOUN:.*?\n/gi, "").trim();
          
          const logUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
          await fetch(logUrl, {
            method: 'POST',
            headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              "insertOne": { "document": { "_id": id, "question": question, "answer": finalCounsel, "noun": noun, "seed": seed, "created_at": new Date().toISOString() } }
            })
          });
        } catch (e) { }
      }
    });

    return new Response(aiRes.body.pipeThrough(transformStream), {
      headers: { "Content-Type": "text/event-stream", "x-share-id": id, "x-seed": seed.toString() }
    });
  } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500 }); }
}
