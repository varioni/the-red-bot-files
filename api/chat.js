export default async function handler(req, res) {
  try {
    // This is the "Old Reliable" way to read the question
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    const { question } = JSON.parse(body);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [{ role: "system", content: "You are Nick Cave. Answer with poetic soul." },
                   { role: "user", content: question }]
      })
    });

    const data = await response.json();
    res.status(200).json({ answer: data.choices[0].message.content });

  } catch (err) {
    res.status(200).json({ answer: "The archive is almost open. Error: " + err.message });
  }
}
