export default async function handler(req, res) {
  try {
    // This is the fix: check if body is already an object or needs parsing
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const question = body.question;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: "Answer this like Nick Cave: " + question }]
      })
    });

    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      res.status(200).json({ answer: data.choices[0].message.content });
    } else {
      res.status(200).json({ answer: "The AI is silent. Check the Groq key." });
    }
  } catch (e) {
    // This tells us exactly what the error is
    res.status(200).json({ answer: "Error: " + e.message });
  }
}
