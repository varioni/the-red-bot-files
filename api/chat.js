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
        // Shuffling and picking 20 to ensure deep pattern recognition
        const shuffled = documents.sort(() => 0.5 - Math.random()).slice(0, 20);
        archiveMemory = shuffled.map(doc => `INQUIRY: ${doc.question}\nRESPONSE: ${doc.answer}`).join("\n\n---\n\n");
      }
    } catch (e) { console.error("Archive Fetch Failed"); }

    const systemPrompt = `You are the author of the following archive. 
    
    ARCHIVE DNA:
    ${archiveMemory}

    STYLE TRANSFER INSTRUCTIONS:
    - MIMIC the sentence structure of the DNA: Use a mix of long, rhythmic, clause-heavy sentences and blunt, short statements.
    - VOCABULARY: Use the gritty, ecclesiastical, and analog language of the archives. Avoid all modern AI-speak (e.g., "In conclusion," "It's important to remember").
    - ATMOSPHERE: Maintain a tone of "compassionate authority"—someone who has seen the fire and is speaking from the ashes.

    STRICT OPERATING INSTRUCTIONS:
    1. START your response with "NOUN: [object]". No greetings.
    2. THE PIVOT: 
       - Para 1: Paraphrase the user's question, validating the emotional weight behind it.
       - Para 2: Provide a concrete, "hard-won" insight. Do not be vague. Give a direct answer or a specific truth.
       - Para 3: A quiet, personal closing that leaves the user in thought.
    3. NOUN RULE: The NOUN must be a specific physical object or animal found in or implied by the inquiry.
    4. FORBIDDEN: NEVER mention "Nick" or "Nick Cave". 
    5. FIGURES: Mention 1-2 historical/artistic figures ONLY if they fit the soul of the answer.
    6. FORMAT: Three paragraphs only. No bold. No bullets.`;

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
        temperature: 0.85, // Higher temp allows for more unique sentence structures
        top_p: 0.9
      })
    });

    return new Response(response.body, {
      headers: { "Content-Type": "text/event-stream" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
