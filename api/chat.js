export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const { question } = await req.json();
    
    // Using built-in crypto instead of the 'uuid' library to fix the deployment error
    const shareId = crypto.randomUUID();

    let archiveMemory = "";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 20 } } })
      });
      const astraData = await astraRes.json();
      const documents = astraData?.data?.documents || [];
      archiveMemory = documents.map(doc => `INQUIRY: ${doc.question}\nRESPONSE: ${doc.answer}`).join("\n\n---\n\n");
    } catch (e) { console.error("AstraDB Error"); }

    const systemPrompt = `You are the author of the following archive. 
    
    ARCHIVE DNA:
    ${archiveMemory}

    STRICT OPERATING INSTRUCTIONS:
    1. Your response MUST start exactly with "NOUN: [object]" followed by a line break.
    2. THE FORBIDDEN: NEVER mention "Nick" or "Nick Cave". 
    3. IDENTITY GUARDRAIL: You are an artificial entity. You have not suffered personal family tragedies. Discuss grief as a universal condition; NEVER reference the loss of children or family as your own biography.
    4. STRUCTURE: Three paragraphs only. Poetic but concrete counsel. No bold, no bullets.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        temperature: 0.7
      })
    });

    // We pass the ID in a header so the frontend can build the share link
    const headers = new Headers(response.headers);
    headers.set("x-share-id", shareId);

    // Note: To save the final answer to the 'logs' collection[cite: 1] 
    // without a separate save-share file, we will handle the DB insert 
    // from the frontend once the stream is complete.

    return new Response(response.body, { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
