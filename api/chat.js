export default async function handler(req, res) {
    const { question } = JSON.parse(req.body);

    try {
        // This talks directly to the AI
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    { role: "system", content: "You are the Red Bot, a digital version of Nick Cave. Answer with deep, poetic wisdom. Be brief but soulful." },
                    { role: "user", content: question }
                ]
            })
        });

        const data = await groqRes.json();
        
        // If the AI gives an answer, show it!
        if (data.choices && data.choices[0]) {
            res.status(200).json({ answer: data.choices[0].message.content });
        } else {
            res.status(200).json({ answer: "The archive is dark. Ask me again, gently." });
        }

    } catch (error) {
        res.status(200).json({ answer: "My soul is wandering. One more time?" });
    }
}
