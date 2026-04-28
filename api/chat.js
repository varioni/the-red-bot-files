export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const { question } = await req.json();
    const id = crypto.randomUUID(); 

    // 1. Fetch DNA from Archives
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
    } catch (e) { console.error("AstraDB Archive Error"); }

    // 2. Save Initial Log (Question + ID) to 'logs' collection
    try {
      const logUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
      await fetch(logUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "insertOne": {
            "document": { "_id": id, "question": question, "created_at": new Date().toISOString() }
          }
        })
      });
    } catch (e) { console.error("AstraDB Log Error"); }

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

    const headers = new Headers(response.headers);
    headers.set("x-share-id", id);

    return new Response(response.body, { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
