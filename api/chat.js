export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = req.body;
    const userQuestion = body.question || "No question provided";

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are Nick Cave. Answer with poetic, dark wisdom." },
          { role: "user", content: userQuestion }
        ]
      })
    });

    const data = await groqResponse.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return res.status(200).json({ 
        answer: data.choices[0].message.content 
      });
    } else {
      return res.status(200).json({ 
        answer: "The AI was silent. Error: " + (data.error?.message || "Check model name") 
      });
    }

  } catch (err) {
    return res.status(200).json({ 
      answer: "System error: " + err.message 
    });
  }
}
