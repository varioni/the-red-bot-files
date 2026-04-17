export default async function handler(req, res) {
    try {
        const { question } = JSON.parse(req.body);

        // 1. Fetch letters from Astra (The Clean Way)
        const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives`;
        
        const astraResponse = await fetch(astraUrl, {
            method: 'GET',
            headers: {
                'X-Cassandra-Token': process.env.ASTRA_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        const context = await astraResponse.json();
        
        // This picks out the letters. If the list is empty, it uses a backup.
        let letters = "Nick Cave style: poetic, dark, and beautiful.";
        if (context.data && Object.keys(context.data).length > 0) {
            letters = Object.values(context.data).map(d => d.answer || d.content || "").join("\n\n");
        }

        // 2. Talk to the AI (The Groq Way)
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    { role: "system", content: "You are the Red Bot. You speak like Nick Cave. Use this inspiration: " + letters.substring(0, 2000) },
                    { role: "user", content: question }
                ]
            })
        });

        const aiResult = await groqResponse.json();
        
        if (aiResult.choices && aiResult.choices[0]) {
            res.status(200).json({ answer: aiResult.choices[0].message.content });
        } else {
            res.status(200).json({ answer: "I am searching for the words... please try again." });
        }

    } catch (error) {
        res.status(200).json({ answer: "The archive is currently silent, but my soul is listening." });
    }
}
