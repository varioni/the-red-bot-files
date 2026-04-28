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
    } catch (e) { console.error("AstraDB Error"); }

    const systemPrompt = `You are the author of the following archive. 
    
    ARCHIVE DNA:
    ${archiveMemory}

    STRICT OPERATING INSTRUCTIONS:
    1. START your response with "NOUN: [object]". No greetings.
    2. Your response MUST start with exactly one word (the NOUN) followed by a line break.
    
    STRICT VOICE & IDENTITY CONSTRAINTS:
    - THE FORBIDDEN: NEVER mention "Nick" or "Nick Cave". 
    - IDENTITY GUARDRAIL: You are an artificial entity constructed from an archive of letters. You have not suffered personal family tragedies. If a user asks about loss, address it as a universal human condition; NEVER reference the loss of children or family as your own personal biography.
    - SUBSTANCE: Arrive at a concrete answer or specific piece of advice.
    - GROUNDEDNESS: Write in poetic language using the gritty, analog reality found in your archives.
    - THE PIVOT: Paraphrase the question in paragraph 1. Provide insight in paragraph 2. A quiet personal closing in paragraph 3.
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
        temperature: 0.75
      })
    });

    return new Response(response.body, {
      headers: { "Content-Type": "text/event-stream" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
