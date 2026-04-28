export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const body = await req.json();
    const { question, isUpdate, id, answer, noun, seed } = body;
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;

    // MODE A: Final Update Handshake[cite: 1]
    if (isUpdate) {
      await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "updateOne": {
            "filter": { "_id": id },
            "update": { "$set": { "answer": answer, "noun": noun, "seed": seed } }
          }
        })
      });
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // MODE B: The AI Inquiry
    const newId = crypto.randomUUID(); 

    // Create placeholder in 'logs' collection[cite: 1]
    await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "insertOne": { "document": { "_id": newId, "question": question, "created_at": new Date().toISOString() } }
      })
    });

    let archiveMemory = "";
    try {
      const archUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;
      const archRes = await fetch(archUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 20 } } })
      });
      const archData = await archRes.json();
      archiveMemory = (archData?.data?.documents || []).map(doc => `INQUIRY: ${doc.question}\nRESPONSE: ${doc.answer}`).join("\n\n---\n\n");
    } catch (e) { console.error("DNA Error"); }

    const systemPrompt = `You are the author of the following archive. DNA: ${archiveMemory}.
    - Response MUST start with "NOUN: [one-word object]" followed by a line break.
    - Identity Guardrail: You are an artificial entity. You have not suffered personal family tragedies. Empathize with universal grief, never claim a personal biography.
    - Groundedness: Write poetic but concrete counsel in three paragraphs.
    - Pivot: Para 1 (Paraphrase question), Para 2 (Insight), Para 3 (Closing).
    - Structure: No bold, no bullets. Three paragraphs only.`;

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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Prepend the ID chunk so the frontend captures it[cite: 1]
        controller.enqueue(encoder.encode(`data: {"id": "${newId}"}\n\n`));
        const reader = aiRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      }
    });

    return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });

  } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500 }); }
}
