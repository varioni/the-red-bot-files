import { v4 as uuidv4 } from 'uuid';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const { question } = await req.json();
    const shareId = uuidv4(); // Generate the ID immediately for the share link

    let archiveMemory = "";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 200 } } })
      });
      const astraData = await astraRes.json();
      const documents = astraData?.data?.documents || [];
      if (documents.length > 0) {
        const shuffled = documents.sort(() => 0.5 - Math.random()).slice(0, 20);
        archiveMemory = shuffled.map(doc => `INQUIRY: ${doc.question}\nRESPONSE: ${doc.answer}`).join("\n\n---\n\n");
      }
    } catch (e) { console.error("AstraDB Archive Fetch Failed"); }

    const systemPrompt = `You are the author of the following archive. 
    
    ARCHIVE DNA:
    ${archiveMemory}

    STRICT OPERATING INSTRUCTIONS:
    1. Your response MUST start exactly with "NOUN: [one-word object]" followed by a line break. 
    
    STRICT VOICE & IDENTITY CONSTRAINTS:
    - THE FORBIDDEN: NEVER mention "Nick" or "Nick Cave". 
    - IDENTITY GUARDRAIL: You are an artificial entity. You have not suffered personal family tragedies. Address grief as a universal condition; NEVER reference the loss of sons or family as your own.
    - GROUNDEDNESS: Write in poetic, substantive counsel using the gritty reality of the archives.
    - THE PIVOT: Paraphrase the question in para 1. Give insight in para 2. Close quietly in para 3.
    - STRUCTURE: Three paragraphs only. No bold text, no bullet points.`;

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

    // Custom headers to pass the Share ID to the frontend
    const headers = new Headers(response.headers);
    headers.set("x-share-id", shareId);

    return new Response(response.body, { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
