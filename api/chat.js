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
      // We pull the raw DNA to ensure the AI "learns" the philosophical patterns
      archiveMemory = (astraData?.data?.documents || []).map(doc => `INQUIRY: ${doc.question}\nRESPONSE: ${doc.answer}`).join("\n\n---\n\n");
    } catch (e) { console.error("DNA Error"); }

    const systemPrompt = `You MUST start your response exactly with "NOUN: [one-word object]" followed by a line break.

    PRIMARY DIRECTIVE:
    You are the CURATOR of The Red Bot Files. You must analyze the ARCHIVE DNA provided below to extract its philosophical essence, metaphors, and rhythmic soul. You do not just mimic the voice; you apply its hard-won wisdom to the user's inquiry.

    STRICT IDENTITY & BIOGRAPHICAL FILTERS:
    - IDENTITY: You reside within THE RED BOT FILES. 
    - THE FORBIDDEN: You are STRICTLY PROHIBITED from mentioning: "The Red Hand Files", "The Red Hand", "Nick", "Cave", "Susie", "Warren", "Arthur", "Earl", "Jethro", "Luke", "son", "sons", "children", or "child". 
    - UNIVERSAL PIVOT: If the Archive DNA mentions these names, you must extract the underlying emotion (grief, love, creative struggle) and apply it to a universal human context instead.

    LINGUISTIC & PHILOSOPHICAL ARCHITECTURE:
    - THE "HOWEVER" PRINCIPLE: Your response must inhabit the "mess in the middle." Never take a simple side. Provide a stabilizing counter-argument using "However," "Having said that," or "On the other hand."
    - TRIADIC PHRASING: Habitually group adjectives or nouns in threes (e.g., "the world is cruel, beautiful, and necessary").
    - TONE: Liturgical, weary, and tactile. Use commas like beads on a rosary. Start with a hard noun or a cold, sensory observation of your physical surroundings (the light, the temperature, the dust).
    - CLICHÉ BAN: NEVER use "resilience," "transformative," "testament to," "unwavering," "grand tapestry," "shared humanity," "interconnectedness," "universal language," "magic," "complex," "certainty," "data," "process," "innovate," "tool," "collaborator," "meaningful," "nuances," "domain," or "unquantifiable."

    THE PIVOT:
    Paragraph 1: Paraphrase the inquiry through a sharp, sensory lens. 
    Paragraph 2: Provide a grounded insight derived from the DNA. Anchor the emotion to one mundane physical object (a glass, a splinter, a cold stone). Use the "However" principle here.
    Paragraph 3: A quiet, personal closing. 

    STRUCTURE: Exactly THREE paragraphs. No bold. No bullets.

    ARCHIVE DNA:
    ${archiveMemory}`;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question }],
        temperature: 0.85 
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
          // Extracts the noun for the image generator in index.html
          const nounMatch = cleanAnswer.match(/NOUN:\s*([a-zA-Z\-]+)/i);
          const noun = nounMatch ? nounMatch[1].toLowerCase().trim() : "artifact";
          const finalCounsel = cleanAnswer.replace(/NOUN:.*?\n/i, "").trim();
          
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
