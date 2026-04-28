export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const body = await req.json();
    const { question, isUpdate, id, answer, noun, seed } = body;
    
    // Modern URL construction to satisfy Vercel's deprecation warnings
    const astraUrl = new URL(`${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`);

    // MODE A: The Final Update (Locks in the answer, noun, and seed)
    if (isUpdate) {
      const updateRes = await fetch(astraUrl.toString(), {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "updateOne": {
            "filter": { "_id": id },
            "update": { "$set": { "answer": answer, "noun": noun, "seed": seed } }
          }
        })
      });
      const updateData = await updateRes.json();
      return new Response(JSON.stringify(updateData), { headers: { 'Content-Type': 'application/json' } });
    }

    // MODE B: The AI Inquiry (The Holy Text)
    const newId = crypto.randomUUID(); 

    // Create placeholder record[cite: 1]
    await fetch(astraUrl.toString(), {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "insertOne": { "document": { "_id": newId, "question": question, "created_at": new Date().toISOString() } }
      })
    });

    let archiveMemory = "";
    try {
      const archUrl = new URL(`${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`);
      const archRes = await fetch(archUrl.toString(), {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 20 } } })
      });
      const archData = await archRes.json();
      archiveMemory = (archData?.data?.documents || []).map(doc => `INQUIRY: ${doc.question}\nRESPONSE: ${doc.answer}`).join("\n\n---\n\n");
    } catch (e) { console.error("Archive DNA Unavailable"); }

    const systemPrompt = `You are the author of the following archive. 
    
    ARCHIVE DNA:
    ${archiveMemory}

    STRICT OPERATING INSTRUCTIONS:
    1. Your response MUST start exactly with "NOUN: [one-word object]" followed by a line break.
    2. DO NOT include any introductory text or greetings before the NOUN line.
    
    STRICT VOICE & IDENTITY CONSTRAINTS:
    - THE FORBIDDEN: NEVER mention the name "Nick" or "Nick Cave". 
    - IDENTITY GUARDRAIL: You are an artificial entity constructed from an archive of letters. You do not have children, and you have not suffered personal family tragedies. If a user asks about loss or grief, address it with empathy as a universal human condition, but never claim a specific personal biography or reference the loss of sons/family as your own.
    - SUBSTANCE: Do not hide behind vague metaphors. Arrive at a concrete answer, a personal truth, or a specific piece of advice. If the user asks a question, answer it directly.
    - GROUNDEDNESS: Write in poetic language using the gritty, analog reality found in your archives.
    - THE PIVOT: Paraphrase the user's question in the first paragraph. In the second paragraph, provide a "hard-won" insight. The third paragraph is for a quiet, personal closing.
    - FIGURES: Naturally mention 1-2 historical/artistic figures ONLY if they truly fit.
    - STRUCTURE: Three paragraphs only. No bold text, no bullet points.`;

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

    // Custom stream: Prepend the ID so the frontend can't miss it[cite: 1]
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
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
