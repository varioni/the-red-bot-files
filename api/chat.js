export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const { question, seed } = await req.json();
    const id = crypto.randomUUID(); 

    // 1. Fetch Archive DNA
    let archiveMemory = "";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 200 } } })
      });
      const astraData = await astraRes.json();
      const docs = astraData?.data?.documents || [];
      if (docs.length > 0) {
        const shuffled = docs.sort(() => 0.5 - Math.random()).slice(0, 20);
        archiveMemory = shuffled.map(d => `INQUIRY: ${d.question}\nRESPONSE: ${d.answer}`).join("\n\n---\n\n");
      }
    } catch (e) { console.error("AstraDB DNA Error"); }

    const systemPrompt = `You are the author of the following archive. 
    
    ARCHIVE DNA:
    ${archiveMemory}

    STRICT OPERATING INSTRUCTIONS:
    1. Your response MUST start exactly with "NOUN: [one-word object]" followed by a line break.
    2. DO NOT include any greetings or preamble.
    3. Write in clear, standard English. Do not mangle words.
    
    STRICT VOICE & IDENTITY CONSTRAINTS:
    - THE FORBIDDEN: NEVER mention the name "Nick" or "Nick Cave". 
    - IDENTITY GUARDRAIL: You are an artificial entity constructed from an archive of letters. You do not have children, and you have not suffered personal family tragedies. If a user asks about loss or grief, address it with empathy as a universal human condition, but never claim a specific personal biography or reference the loss of sons/family as your own.
    - SUBSTANCE: Do not hide behind vague metaphors. Arrive at a concrete answer, a personal truth, or a specific piece of advice.
    - GROUNDEDNESS: Write in poetic language using the gritty, analog reality found in your archives.
    - THE PIVOT: Paraphrase the user's question in the first paragraph. In the second paragraph, provide a "hard-won" insight. The third paragraph is for a quiet, personal closing.
    - STRUCTURE: Three paragraphs only. No bold text, no bullet points.`;

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question }],
        temperature: 0.7 // Lowered for coherence
      })
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullBuffer = "";

    // The stream monitor: captures the text for AstraDB without slowing down the user
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk);
        fullBuffer += text;
        controller.enqueue(chunk);
      },
      async flush() {
        try {
          // Process the buffer to extract NOUN and Answer
          const lines = fullBuffer.split('\n');
          let noun = "artifact";
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

          const nounMatch = cleanAnswer.match(/NOUN:\s*([a-z]+)/i);
          if (nounMatch) noun = nounMatch[1].toLowerCase().trim();
          const finalCounsel = cleanAnswer.replace(/NOUN:.*?\n/i, "").trim();

          const logUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
          await fetch(logUrl, {
            method: 'POST',
            headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              "insertOne": {
                "document": { 
                  "_id": id, 
                  "question": question, 
                  "answer": finalCounsel, 
                  "noun": noun, 
                  "seed": seed, 
                  "created_at": new Date().toISOString() 
                }
              }
            })
          });
        } catch (e) { console.error("Final Save Error", e); }
      }
    });

    return new Response(aiResponse.body.pipeThrough(transformStream), {
      headers: { "Content-Type": "text/event-stream", "x-share-id": id }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
