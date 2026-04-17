export default async function (req, res) {
  try {
    const { question } = await req.json();

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
    return res.status(200).json({ answer: data.choices[0].message.content });
  } catch (err) {
    return res.status(200).json({ answer: "I can hear you now, but I'm still finding my voice. Error: " + err.message });
  }
}
