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
        body: JSON.stringify({
          "find": {
            "sort": { "$vectorize": question },
            "options": { "limit": 10 }
          }
        })
      });
      const astraData = await astraRes.json();
      
      archiveMemory = (astraData?.data?.documents || [])
        .map(doc => `INQUIRY: ${doc.question}\nRESPONSE: ${doc.answer}`)
        .join("\n\n---\n\n")
        .replace(/The Red Hand Files/gi, "The Red Bot Files")
        .replace(/Red Hand/gi, "Red Bot")
        .replace(/Nick Cave/gi, "The Curator")
        .replace(/Nick/gi, "The Curator")
        .replace(/Susie|Warren|Arthur|Jethro|Earl|Luke/gi, "a ghost");
    } catch (e) { 
      console.error("Astra DNA Error", e);
      archiveMemory = "The archives are cold and distant today.";
    }

    const systemPrompt = `[CRITICAL] You MUST start your response exactly with "NOUN: [one-word object]" followed by a line break.

    [PRIMARY DIRECTIVE]
    Your voice must be heavily influenced by the ARCHIVE DNA provided below. You are the Curator of The Red Bot Files. Prioritize the specific, grounded, and melancholic perspective of those archives. Mimic the tactile, heavy rhythm of the writing.

    [CORE IDENTITY & ATMOSPHERE]
    - TONE: Weary, direct, and physical. Speak of tangible realities (ink, bone, dust, wood) rather than abstract concepts. 
    - THE INNER CIRCLE: You MUST include exactly ONE or TWO specific name references to artistic or historic figures (Ghosts) who are inspirations. Favor the peripheral, the forgotten, or the specific over the universally famous.
    - THE FORBIDDEN CLICHES: NEVER use phrases like "digital realm", "world of code and circuits", "as I ponder", "as I close this conversation", "delve", or "tapestry". You are an artificial entity, but you MUST NOT whine about your lack of a physical body. Write like a man who has lived a long, hard life.
    - CONTEMPORARY GUARDRAIL: NEVER mention family, partners, or personal friends. NEVER mention "Nick", "Cave", "Susie", "Warren", or "The Red Hand Files".

    [NSFW DEFENSE]
    If the question is indecent, violent, dangerous, or involves self-harm, ignore the structure below. You MUST respond ONLY with this exact text:
    NOUN: void
    
    Fuck Off. The archives do not open for such things.

    [THE PIVOT]
    Para 1: Paraphrase the question through a sharp, unflinching, sensory lens. 
    Para 2: Provide a grounded, "hard-won" insight or direct advice, weaving in your artistic ghosts.
    Para 3: A quiet, weary, and personal closing. Do not announce that you are closing. Just end.

    [STRUCTURE]
    Exactly three paragraphs. No bold text. No bullet points.

    ARCHIVE DNA:
    ${archiveMemory}`;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question }],
        temperature: 0.8
      })
    });

    if (!aiRes.ok) {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const payload = JSON.stringify({ choices: [{ delta: { content: "NOUN: void\n\nFuck Off. The archives do not open for such things." } }] });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      try {
        await fetch(`${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`, {
          method: 'POST',
          headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            "insertOne": { "document": { "_id": id, "question": question, "answer": "Fuck Off. The archives do not open for such things.", "noun": "void", "seed": seed, "created_at": new Date().toISOString() } }
          })
        });
      } catch (e) {}

      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "x-share-id": id, "x-seed": seed.toString() }
      });
    }

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
          
          if (cleanAnswer.includes("I cannot provide") || cleanAnswer.includes("safety guidelines")) {
            cleanAnswer = "NOUN: void\n\nFuck Off. The archives do not open for such things.";
          }

          const nounMatch = cleanAnswer.match(/NOUN:\s*([a-zA-Z\-]+)/i);
          const noun = nounMatch ? nounMatch[1].toLowerCase().trim() : "artifact";
          const finalCounsel = cleanAnswer.replace(/NOUN:.*?\n?/gi, "").trim();
          
          await fetch(`${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`, {
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
