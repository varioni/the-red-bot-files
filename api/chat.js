export default async function handler(req, res) {
  // 1. Force Vercel to allow the request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 2. Read the body safely
    const body = req.body;
    const userQuestion = body.question || "No question provided";

    // 3. Talk to Groq
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: "You are Nick Cave. Answer with poetic, dark wisdom." },
          { role: "user", content: userQuestion }
        ]
      })
    });

    const data = await groqResponse.json();

    // 4. Handle the AI's answer
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return res.status(200).json({ 
        answer: data.choices[0].message.content 
      });
    } else {
      // If Groq sends back an error, we want to see it
      console.error("Groq Error:", data);
      return res.status(200).json({ 
        answer: "The AI was silent. Error: " + (data.error?.message || "Unknown Groq error") 
      });
    }

  } catch (err) {
    console.error("System Error:", err);
    return res.status(200).json({ 
      answer: "System error: " + err.message 
    });
  }
}
