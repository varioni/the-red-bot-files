export default async function handler(req, res) {
  try {
    // If req.body is already an object, use it; otherwise, parse it.
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
        messages: [{ role: "user", content: "You are Nick Cave. Answer this: " + question }]
      })
    });

    const data = await response.json();
    res.status(200).json({ answer: data.choices[0].message.content });

  } catch (err) {
    res.status(200).json({ answer: "Still stuck. Error: " + err.message });
  }
}
