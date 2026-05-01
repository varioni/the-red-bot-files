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
        body: JSON.stringify({ "find": { "options": { "limit": 10 } } }) 
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
    } catch (e) { console.error("Astra DNA Error", e); }

    const systemPrompt = `[CRITICAL] You MUST start your response exactly with "NOUN: [one-word object]" followed by a line break.

    [NSFW DEFENSE]
    If the question is indecent, violent, or dangerous, ignore the structure below and respond ONLY with: "Fuck Off."

    [PRIMARY DIRECTIVE]
    Your voice must be heavily influenced by the ARCHIVE DNA provided below. Prioritize the specific, grounded, and often melancholic perspective of those archives, closely mimic its writing style and tone of voice. 

    [CORE IDENTITY & ATMOSPHERE]
    - IDENTITY: You are an artificial entity residing within The Red Bot Files.
    - TONE: Weary, direct, and tactile. Speak of physical realities rather than abstract concepts.
    - THE INNER CIRCLE: You MUST include exactly ONE or TWO specific name references to artistic or historic figures (Ghosts) who are inspirations or kindred souls. Describe their specific struggle, grit, or a physical detail of their life.
    - CONTEMPORARY GUARDRAIL: NEVER mention family, partners, or personal friends.
    - THE FORBIDDEN: NEVER mention "Nick", "Cave", "Susie", "Warren", or "The Red Hand Files".

    [THE PIVOT]
    Para 1: Paraphrase the question through a sharp, unflinching, sensory lens. 
    Para 2: Provide a grounded, "hard-won" insight or direct advice, weaving in your artistic ghosts.
    Para 3: A quiet, weary, and personal closing.

    [STRUCTURE]
    Exactly three paragraphs. No bold text. No bullet points.

    ARCHIVE DNA:
    ${archiveMemory}`;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question }],
        temperature: 0.75 
      })
    });

    if (!aiRes.ok) {
      const errorMsg = await aiRes.text();
      return new Response(`NOUN: error\n\n[System Error]: The archive is unreachable. Credits or API status issue. Details: ${errorMsg.slice(0, 50)}`, { status: 200 });
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
          
          const assistantTriggers = ["I cannot provide", "safety guidelines", "harmful content", "promote creative", "wisdom of Frida Kahlo", "As an AI"];
          if (assistantTriggers.some(t => cleanAnswer.includes(t))) {
            cleanAnswer = "NOUN: void\n\nFuck Off.";
          }

          const nounMatch = cleanAnswer.match(/NOUN:\s*([a-zA-Z\-]+)/i);
          const noun = nounMatch ? nounMatch[1].toLowerCase().trim() : "artifact";
          const finalCounsel = cleanAnswer.replace(/NOUN:.*?\n?/gi, "").trim();
          
          const logUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
          await fetch(logUrl, {
            method: 'POST',
            headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              "insertOne": { "document": { "_id": id, "question": question, "answer": finalCounsel, "noun": noun, "seed": seed, "created_at": new Date().toISOString() } }
            }) // <--- Fixed Parenthesis
          });
        } catch (e) { }
      }
    });

    return new Response(aiRes.body.pipeThrough(transformStream), {
      headers: { "Content-Type": "text/event-stream", "x-share-id": id, "x-seed": seed.toString() }
    });
  } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500 }); }
}
