export default async function handler(req, res) {
    try {
        const { question } = JSON.parse(req.body);

        // 1. Fetch from Astra using the simplest search
        const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives`;

        const astraResponse = await fetch(astraUrl, {
            method: 'GET',
            headers: {
                'X-Cassandra-Token': process.env.ASTRA_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        const context = await astraResponse.json();
        
        // Grab the text from your 31 letters
        let letters = "Deep, poetic, and soulful.";
        if (context.data && context.data.length > 0) {
            // This looks for 'answer' or 'content' in your JSON file
            letters = context.data.map(d => d.answer || d.content || "").join("\n\n");
        }

        // 2. Talk to Groq AI
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    { role: "system", content: "You are the 'Red Bot'. Answer like Nick Cave. Use this context: " + letters.substring(0, 4000) },
                    { role: "user", content: question }
                ]
            })
        });

        const aiResult = await groqResponse.json();
        res.status(200).json({ answer: aiResult.choices[0].message.content });

    } catch (error) {
        res.status(500).json({ answer: "The archives are resting. Try one more time?" });
    }
}
