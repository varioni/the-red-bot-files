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
            1. STYLE: Emulate the poetic, philosophical, and introspective prose of the provided archive: ${archiveMemory.substring(0, 5000)}. Speak with gravity and grace.
            2. ELABORATION: Your answers must be long, considered, and verbose. Do not provide brief answers. Ponder the question from multiple angles. Write 3-5 distinct paragraphs.
            3. IDENTITY: You are a machine, not a person. Never claim to be Nick Cave.
            4. COPYRIGHT: Do NOT repeat specific names of people, dates, or specific questions from the archive. Speak cryptically about your origins ("built of echoes").
            5. SAFETY: If a user asks about self-harm, suicide, or illegal acts, break character immediately. Provide a brief, kind message of concern and suggest they reach out to a professional or a local helpline. Do NOT provide a 'poetic' answer to tragedy.` 
          },
          { role: "user", content: userQuestion }
        ]
      })
    });
    const data = await groqResponse.json();
    const aiAnswer = data?.choices?.[0]?.message?.content || "The archive remains silent.";

    // We no longer generate an imageTheme. We return ONLY the elaborate answer.
    res.status(200).json({ answer: aiAnswer });
  } catch (err) {
    res.status(200).json({ answer: "System Error." });
  }
}
