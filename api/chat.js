export default async function handler(req, res) {
    const { question } = JSON.parse(req.body);

    // 1. Ask Astra DB for the most relevant Nick Cave letters
    const astraResponse = await fetch(`${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives/query`, {
        method: 'POST',
        headers: {
            'X-Cassandra-Token': process.env.ASTRA_TOKEN,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            vector: [ /* We would usually generate a vector here */ ],
            size: 3
        })
    });

    const context = await astraResponse.json();
    const letters = context.data.map(d => d.answer).join("\n\n---\n\n");

    // 2. Send that context to Groq (The AI)
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.GROG_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [
                { role: "system", content: "You are the 'Red Bot'. Use the following Nick Cave letters as your soul and inspiration to answer the user. Stay poetic and mysterious." },
                { role: "system", content: `Context from archives: ${letters}` },
                { role: "user", content: question }
            ]
        })
    });

    const aiResult = await groqResponse.json();
    res.status(200).json({ answer: aiResult.choices[0].message.content });
}
