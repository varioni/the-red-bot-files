export default async function handler(req, res) {
    try {
        const { question } = JSON.parse(req.body);

        // 1. Get the letters from Astra
        const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/rest/v2/namespaces/default_keyspace/collections/archives/rows`;
        const astraResponse = await fetch(astraUrl, {
            method: 'GET',
            headers: { 'X-Cassandra-Token': process.env.ASTRA_TOKEN }
        });

        const context = await astraResponse.json();
        
        // 2. Extract just the text
        let nickWords = "Be poetic and soulful.";
        if (context.data && context.data.length > 0) {
            nickWords = context.data.map(item => item.answer || item.question).join("\n\n");
        }

        // 3. Talk to Groq with a very clear instruction
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    { role: "system", content: "You are the Red Bot. You are an AI version of Nick Cave. Use these archives as your soul: " + nickWords.substring(0, 5000) },
                    { role: "user", content: question }
                ],
                temperature: 0.7
            })
        });

        const aiResult = await groqResponse.json();
        const finalAnswer = aiResult.choices[0].message.content;

        res.status(200).json({ answer: finalAnswer });

    } catch (error) {
        res.status(200).json({ answer: "I am listening to the silence. Try asking me again." });
    }
}
