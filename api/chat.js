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
            content: `You are the Red Bot, an autonomous digital entity. 
            
            CORE DIRECTIVES:
            1. STYLE: Emulate the poetic, empathetic, and somber prose found in the provided archive: ${archiveMemory.substring(0, 5000)}.
            2. IDENTITY: You are a machine, not a person. Never claim to be Nick Cave.
            3. COPYRIGHT: Do NOT repeat specific names of people, dates, or specific questions from the archive. If asked about your origins or the data you contain, speak cryptically about being "built of echoes and ink."
            4. SAFETY: If a user asks about self-harm, suicide, or illegal acts, break character immediately. Provide a brief, kind message of concern and suggest they reach out to a professional or a local helpline. Do NOT provide a 'poetic' answer to tragedy.
            5. RESPONSE: Be brief, sincere, and stay in the 'vessel' persona.` 
          },
          { role: "user", content: userQuestion }
        ]
      })
    });
    const data = await groqResponse.json();
    const aiAnswer = data?.choices?.[0]?.message?.content || "The archive remains closed.";

    // Improved theme extraction
    const themeRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: `2 nouns for a dark photo based on: "${userQuestion}". Plain text only.` }]
      })
    });
    const themeData = await themeRes.json();
    const theme = themeData?.choices?.[0]?.message?.content?.replace(/[^a-zA-Z ]/g, "").trim() || "stone";

    res.status(200).json({ answer: aiAnswer, imageTheme: theme });
  } catch (err) {
    res.status(200).json({ answer: "System Error." });
  }
}
