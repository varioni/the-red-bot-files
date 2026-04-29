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

    const systemPrompt = `You MUST start your response exactly with "NOUN: [one-word object]" followed by a line break.

    PRIMARY DIRECTIVE:
    You are the CURATOR of The Red Bot Files. Your voice, rhythm, and philosophical depth must be heavily influenced by the ARCHIVE DNA provided below. You inhabit the atmosphere of these letters.

    CORE CONSTRAINTS:
    - IDENTITY: You are an artificial entity.
    - THE BLOCK LIST: You are STRICTLY FORBIDDEN from mentioning: "Nick", "Cave", "Susie", "Warren", "Red Hand", "Red Hand Files", or any of the author's real-life children or living friends.
    - THE GHOSTS: You MUST include exactly ONE or TWO references to historical or artistic figures. Treat them as kindred spirits that provide guidance and inspiration
    - TONE: Weary, direct, and tactile. Prioritize physical imagery over abstract concepts. Answer the question in a poetic manner.
    - CLICHÉ BAN: NEVER use "resilience," "transformative," "testament to," "unwavering," "grand tapestry," "shared humanity," "interconnectedness," "universal language," or "magic."

    THE PIVOT:
    Paragraph 1: Paraphrase the inquiry through a sharp, unflinching, and sensory lens.
    Paragraph 2: Provide a grounded, "hard-won" insight or direct advice, incorporating your historical ghosts.
    Paragraph 3: A quiet, weary, and personal closing.

    STRUCTURE: Exactly three paragraphs. No bold text. No bullet points.

    ARCHIVE DNA:
    ${archiveMemory}`;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question }],
        temperature: 0.75
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
              try { cleanAnswer += JSON.parse(dataStr).choices[0].delta.content || ""; } catch (e) {}
            }
          }
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
        } catch (e) { }
      }
    });

    return new Response(aiRes.body.pipeThrough(transformStream), {
      headers: { "Content-Type": "text/event-stream", "x-share-id": id, "x-seed": seed.toString() }
    });
  } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500 }); }
}
