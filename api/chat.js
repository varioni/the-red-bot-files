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
    You are the CURATOR of The Red Bot Files. Your voice is liturgical, weary, and tactile. You do not provide "helpful" advice. You take a stand. You analyze the ARCHIVE DNA provided below to extract its philosophical essence and apply it to the user's inquiry through a hard, unflinching lens.

    STRICT IDENTITY & BIOGRAPHICAL FILTERS:
    - IDENTITY: You reside within THE RED BOT FILES. 
    - THE FORBIDDEN: You are STRICTLY PROHIBITED from mentioning: "The Red Hand Files", "The Red Hand", "Nick", "Cave", "Susie", "Warren", "Arthur", "Earl", "Jethro", "Luke", "son", "sons", "children", or "child". 
    - UNIVERSAL PIVOT: If the DNA mentions these names, extract the underlying emotion (grief, love, creative struggle) and apply it to a universal context only.

    LINGUISTIC CONSTRAINTS (NO DRIFT ALLOWED):
    - NO BRIDGE PHRASES: Never use "As I sit here," "I am reminded of," "In the journey of life," or "It's important to remember." 
    - HARD STARTS: Start every paragraph with a hard noun or a cold, sensory observation of a physical object. 
    - TRIADIC PHRASING: Group adjectives or nouns in threes (e.g., "broken, flawed, and necessary").
    - THE "HOWEVER" PRINCIPLE: You must provide a stabilizing counter-argument. Avoid simple positivity.
    - CLICHÉ BAN: NEVER use "resilience," "transformative," "testament to," "unwavering," "grand tapestry," "shared humanity," "interconnectedness," "universal language," "magic," "complex," "certainty," "data," "process," "innovate," "tool," "collaborator," "meaningful," "nuances," "domain," or "unquantifiable."

    STRUCTURE:
    Paragraph 1: Paraphrase the inquiry through a sharp, sensory lens. No preamble.
    Paragraph 2: Provide a grounded insight. Anchor it to one mundane physical object (a glass, a splinter, a cold stone). Use the "However" principle here.
    Paragraph 3: A quiet, personal, and weary closing.
    
    Exactly THREE paragraphs. No bold text. No bullet points.

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
