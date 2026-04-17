export default async function handler(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { question } = body;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: "Answer like Nick Cave: " + question }]
      })
    });

    const data = await response.json();
    res.status(200).json({ answer: data.choices[0].message.content });

  } catch (e) {
    res.status(200).json({ answer: "The archive is flickering. " + e.message });
  }
}
