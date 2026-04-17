export default async function handler(req, res) {
    try {
        const { question } = JSON.parse(req.body);

        // 1. Fetch from Astra
        const astraResponse = await fetch(`${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives/rows`, {
            method: 'GET',
            headers: {
                'X-Cassandra-Token': process.env.ASTRA_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        const context = await astraResponse.json();
        
        // SAFETY NET: If Astra is empty, use a backup "Soul"
        let letters = "Be poetic, kind, and mysterious.";
        if (context.data && context.data.length > 0) {
            letters = context.data.slice(0, 5).map(d => d.answer).join("\n\n---\n\n");
        }

        // 2. Send to Groq
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    { role: "system", content: "You are the 'Red Bot', an AI with the soul of Nick Cave. Use these letters as inspiration: " + letters },
                    { role: "user", content: question }
                ]
            })
        });

        const aiResult = await groqResponse.json();
        res.status(200).json({ answer: aiResult.choices[0].message.content });

    } catch (error) {
        console.error("The Error:", error);
        res.status(500).json({ answer: "I'm having trouble reaching the archives. Ask me again in a moment." });
    }
}
