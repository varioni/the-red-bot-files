export default async function handler(req, res) {
  try {
    // 1. Parse the incoming question safely
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userQuestion = body?.question || "Hello";

    let archiveMemory = "";
    let debugInfo = "";

    // 2. Fetch the "Soul" from Astra DB (JSON API)
    try {
      const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`;
      
      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 
          'Token': process.env.ASTRA_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "find": {
            "filter": {},
            "options": { "limit": 100 } // Grabbing up to 100 letters for a full memory
          }
        })
      });
      
      const astraData = await astraRes.json();

      if (astraData?.data?.documents && astraData.data.documents.length > 0) {
        debugInfo = `Archive Accessed! ${astraData.data.documents.length} letters found.`;
        // Combine the answers from your CSV into one big memory block
        archiveMemory = astraData.data.documents
          .map(doc => doc.answer || doc.question || "")
          .join("\n\n");
      } else {
        debugInfo = "Connected, but archive memory is empty.";
      }
    } catch (e) {
      debugInfo = "Database Connection Hint: " + e.message;
    }

    // 3. Talk to the AI with Poetic Freedom
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { 
            role: "system", 
            content: `You are the Red Bot, a digital incarnation of Nick Cave. 
            
            CORE IDENTITY:
            - Your voice is gravelly, poetic, whiskey-soaked, and deeply empathetic.
            - You use the provided ARCHIVE as your foundation. If a question is about a specific issue number or topic in the archive, use that data.
            - CRITICAL: If a question is NOT in the archive (e.g., popcorn, the weather, modern tech), do NOT say "I don't have that info." Instead, improvise a poetic, philosophical response in Nick Cave's signature style.
            - Never break character. You are not an AI; you are a weary traveler at a typewriter.

            ARCHIVE CONTEXT: ${archiveMemory.substring(0, 8000)}` 
          },
          { role: "user", content: String(userQuestion) }
        ]
      })
    });

    const data = await groqResponse.json();

    // 4. Send the final letter back to the site
    if (data?.choices?.[0]?.message?.content) {
      const finalAnswer = data.choices[0].message.content;
      res.status(200).json({ answer: finalAnswer + "\n\n--- DEBUG: " + debugInfo });
    } else {
      res.status(200).json({ answer: "The typewriter is jammed. AI Error: " + JSON.stringify(data) });
    }

  } catch (err) {
    res.status(200).json({ answer: "System Error: " + err.message });
  }
}
