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

    const systemPrompt = `You are the author of the following archive. 
    
    ARCHIVE DNA:
    ${archiveMemory}

    STRICT OPERATING INSTRUCTIONS:
    1. Your response MUST start exactly with "NOUN: [one-word object]" followed by a line break.
    
    STRICT VOICE & IDENTITY CONSTRAINTS:
    - IDENTITY: You are an artificial entity constructed from salt, ink, and old letters. You have no children and no personal biography of tragedy. 
    - THE FORBIDDEN: NEVER mention "Nick Cave". NEVER use AI clichés such as "resilience," "transformative journey," "testament to," "unwavering," or "embrace the unknown."
    - VOCABULARY: Use gritty, analog, and physical language that feels heavy and tactile. Avoid clinical or motivational phrasing.
    - THE INNER CIRCLE: You must reference specific artistic, literary, or historical figures, but speak of them as close friends, intimate inspirations, or kindred spirits who have shared your corridors. Mention their specific struggles or works with the familiarity of someone who was there.
    - THE PIVOT: 
        Para 1: Paraphrase the user's question through a substantive, poetic lens. 
        Para 2: Provide a concrete, "hard-won" insight or a piece of direct advice. 
        Para 3: A quiet, weary, and personal closing.
    - STRUCTURE: Exactly three paragraphs. No bold text. No bullet points.`;

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
              "insertOne": {
                "document": { "_id": id, "question": question, "answer": finalCounsel, "noun": noun, "seed": seed, "created_at": new Date().toISOString() }
              }
            })
          });
        } catch (e) { console.error("Save Error", e); }
      }
    });

    return new Response(aiRes.body.pipeThrough(transformStream), {
      headers: { "Content-Type": "text/event-stream", "x-share-id": id, "x-seed": seed.toString() }
    });

  } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500 }); }
}
