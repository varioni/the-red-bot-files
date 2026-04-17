export default async function handler(req, res) {
    try {
        const body = JSON.parse(req.body);
        const question = body.question;

        // 1. The Backup Soul (In case Astra fails)
        let nickContext = "Answer every question with deep empathy, like a poet. Use words like 'love', 'ghosts', 'mercy', and 'the heart'. Be kind but mysterious.";

        // 2. Try to get Astra data (but don't crash if it fails!)
        try {
            const astraUrl = `https://${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives/rows`;
            const astraRes = await fetch(astraUrl, {
                headers: { 'X-Cassandra-Token': process.env.ASTRA_TOKEN }
            });
            const astraData = await astraRes.json();
            if (astraData.data && astraData.data.length > 0) {
                nickContext += " Here are some memories to help: " + astraData.data.map(d => d.answer || d.content).join(" ");
            }
        } catch (e) {
            console.log("Astra is sleeping, using backup soul.");
        }

        // 3. Talk to Groq AI
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    { role: "system", content: "You are the Red Bot. You are Nick Cave's digital soul. " + nickContext.substring(0, 3000) },
                    { role: "user", content: question }
                ]
            })
        });

        const data = await groqRes.json();
        res.status(200).json({ answer: data.choices[0].message.content });

    } catch (error) {
        res.status(200).json({ answer: "I am here, and I am listening. Tell me more." });
    }
}
