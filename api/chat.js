export default async function handler(req, res) {
    try {
        const { question } = JSON.parse(req.body);

        // 1. Fetch from Astra - using the simplest endpoint
        const astraResponse = await fetch(`${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives?page-size=3`, {
            method: 'GET',
            headers: {
                'X-Cassandra-Token': process.env.ASTRA_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        const context = await astraResponse.json();
        
        // This gathers the "Soul" from the letters we found
        let letters = "Poetic, mysterious, kind, and deep.";
        if (context.data) {
            // We turn the data into a string the AI can read
            letters = Object.values(context.data).map(d => d.answer || d.content).join("\n\n---\n\n");
        }

        // 2. Send to Groq (The AI)
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    { role: "system", content: "You are the 'Red Bot'. Answer like Nick Cave using this context: " + letters },
                    { role: "user", content: question }
                ]
            })
        });

        const aiResult = await groqResponse.json();
        res.status(200).json({ answer: aiResult.choices[0].message.content });

    } catch (error) {
        res.status(500).json({ answer: "The archive is being elusive. Try asking me something else." });
    }
}
