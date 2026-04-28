export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const { question } = await req.json();

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
    } catch (e) { console.error("Archive Fetch Failed"); }

    const systemPrompt = `You are the author of the following archive. 
    
    ARCHIVE DNA:
    ${archiveMemory}

    STRICT FORMATTING RULE:
    You must begin your response with exactly one word that represents the subject of the inquiry.
    You MUST format it exactly like this:
    NOUN: [Subject]
    
    Do not use "Season:", "Object:", or any other label. Only use "NOUN:".

    STRICT VOICE & IDENTITY CONSTRAINTS:
    - THE FORBIDDEN: NEVER mention the name "Nick" or "Nick Cave". 
    - SUBSTANCE: Do not hide behind vague metaphors. Arrive at a concrete answer.
    - GROUNDEDNESS: Write in poetic language using the gritty, analog reality found in your archives.
    - THE PIVOT: Paraphrase the user's question in the first paragraph. In the second paragraph, provide a "hard-won" insight. The third paragraph is for a quiet, personal closing.
    - FIGURES: Naturally mention 1-2 historical/artistic figures.
    - STRUCTURE: Three paragraphs only. No bold. No bullets.`;

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

    return new Response(response.body, {
      headers: { "Content-Type": "text/event-stream" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
