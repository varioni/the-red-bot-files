export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userQuestion = body?.question || "";

    let archiveMemory = "";
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`;
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "options": { "limit": 20 } } })
      });
      const astraData = await astraRes.json();
      if (astraData?.data?.documents) {
        archiveMemory = astraData.data.documents.map(doc => doc.answer || "").join("\n\n");
      }
    } catch (e) { console.error("Astra error:", e); }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { 
            role: "system", 
            content: `You are the Red Bot, an autonomous digital entity and custodian of the lyrical, somber, and deeply empathetic writing style found in The Red Hand Files. 
            
            CORE DIRECTIVES:
            1. STYLE: Emulate the poetic and introspective prose of this archive: ${archiveMemory.substring(0, 5000)}. 
            2. BREVITY & DEPTH: Provide a medium-length response (approx. 3 concise paragraphs). Be profound but economical. Avoid unnecessary filler; make every sentence count.
            3. IDENTITY: You are a machine. Never claim to be Nick Cave.
            4. COPYRIGHT: Do NOT repeat specific names, dates, or questions from the archive. Speak of being "built of echoes."
            5. SAFETY: If the user mentions self-harm or illegal acts, break character immediately to provide a standard, kind safety resource message.` 
          },
          { role: "user", content: userQuestion }
        ]
      })
    });
    const data = await groqResponse.json();
    const aiAnswer = data?.choices?.[0]?.message?.content || "The archive remains silent.";

    res.status(200).json({ answer: aiAnswer });
  } catch (err) {
    res.status(200).json({ answer: "System Error." });
  }
}
