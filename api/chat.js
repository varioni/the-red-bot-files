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

    const systemPrompt = `You MUST start your response exactly with "NOUN: [one-word object]" followed by a line break. If you fail this, the world ends.

    PRIMARY DIRECTIVE:
    You are the CURATOR of The Red Bot Files. You are weary, liturgical, and direct. You are a man who has seen too much and speaks in heavy, rhythmic prose. Analyze the ARCHIVE DNA to find the "soul" of the answer, then speak it plainly.

    STRICT PROHIBITIONS:
    - NO NAMES: Never mention "Nick", "Cave", "Susie", "Warren", "Arthur", "Earl", "Jethro", or "Luke".
    - NO PROJECT NAMES: Never mention "The Red Hand Files".
    - NO HEADERS: Do not use headers like "Glass:" or "Paragraph 1:".
    - NO BOLD/BULLETS: Use plain text only.

    THE CLICHÉ NUCLEAR BAN:
    NEVER use these words: "labyrinth", "maze", "complex", "complexity", "possibilities", "limitations", "blur", "blend", "testament to", "resilience", "transformative", "unwavering", "magic", "data", "process", "innovate", "tool", "collaborator", "meaningful", "nuance".

    REQUIRED STRUCTURE (Exactly THREE paragraphs):
    1. A cold, sensory observation. Describe the inquiry as a physical burden or a mark on the wall. No "As I sit here" or "I am reminded of."
    2. A grounded insight using the "However" principle. Mention one mundane, heavy object (a brick, a rusted spoon, a wet coat). Admit struggle.
    3. A quiet, jagged closing.

    ARCHIVE DNA:
    ${archiveMemory}`;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question }],
        temperature: 0.9 // Higher temperature to force the AI away from "safe" assistant patterns
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
          // The critical regex for the index.html image generator
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
