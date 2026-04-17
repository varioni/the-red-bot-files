export default async function handler(req, res) {
    try {
        const { question } = JSON.parse(req.body);

        // WE ARE PUTTING THE KEYS DIRECTLY IN SO THEY CAN'T FAIL
process.env.GROQ_API_KEY.
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    { role: "system", content: "You are Nick Cave. Answer this letter with poetic grace." },
                    { role: "user", content: question }
                ]
            })
        });

        const data = await groqRes.json();
        res.status(200).json({ answer: data.choices[0].message.content });

    } catch (error) {
        res.status(200).json({ answer: "The machine failed, but the soul remains. Try again?" });
    }
}
