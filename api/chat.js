export default async function handler(req, res) {
    try {
        const { question } = JSON.parse(req.body);

        // We try both common keyspace names to be safe
        const keyspace = "default_keyspace"; 
        const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/${keyspace}/collections/archives/rows`;

        const astraResponse = await fetch(astraUrl, {
            method: 'GET',
            headers: {
                'X-Cassandra-Token': process.env.ASTRA_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        const context = await astraResponse.json();
        
        // Let's grab the actual text regardless of how Astra formatted it
        let letters = "Poetic and deep.";
        if (context.data && context.data.length > 0) {
            letters = context.data.map(d => d.answer || d.content || d.text || "").join("\n\n");
        }

        // Now talk to the AI
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    { role: "system", content: "You are the 'Red Bot', an AI with the soul of Nick Cave. Use this context: " + letters.substring(0, 3000) },
                    { role: "user", content: question }
                ]
            })
        });

        const aiResult = await groqResponse.json();
        res.status(200).json({ answer: aiResult.choices[0].message.content });

    } catch (error) {
        console.error(error);
        res.status(500).json({ answer: "The archives are quiet tonight. Ask me something else." });
    }
}
