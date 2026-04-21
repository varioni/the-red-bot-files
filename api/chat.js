export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { messages } = await req.json();
    const userMessage = messages[messages.length - 1].content;

    // --- SAFETY NET ---
    // If the environment variable fails, use the hardcoded URL.
    // PASTE YOUR ACTUAL ENDPOINT URL BETWEEN THE QUOTES BELOW if undefined persists.
    const backupUrl = "https://015199e2-6db1-4032-9774-e07ed7d95fd3-us-east1.apps.astra.datastax.com"; 
    const endpoint = (process.env.ASTRA_DB_API_ENDPOINT || backupUrl).replace(/\/$/, "");

    if (!endpoint || endpoint === "undefined") {
      throw new Error("Endpoint is missing. Please paste your Astra URL into the 'backupUrl' field in chat.js.");
    }

    // 1. Profanity Filter
    const forbiddenWords = ['fuck', 'shit', 'cunt', 'piss', 'nigger', 'faggot'];
    const containsProfanity = forbiddenWords.some(word => userMessage.toLowerCase().includes(word));

    if (containsProfanity) {
      return new Response(JSON.stringify({
        choices: [{ message: { content: "The Ghost remains silent. [Silence]" } }]
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 2. Fetch Archive from Astra DB
    const astraResponse = await fetch(`${endpoint}/api/json/v1/${process.env.ASTRA_DB_NAMESPACE}/archives`, {
      method: 'POST',
      headers: {
        'Token': process.env.ASTRA_DB_APPLICATION_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        find: {
          filter: {},
          options: { limit: 500 }
        }
      }),
    });

    const astraData = await astraResponse.json();
    let documents = astraData.data.documents || [];

    // 3. Shuffle and Select (Fisher-Yates)
    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    const randomSelection = shuffle([...documents]).slice(0, 12);
    const archiveMemory = randomSelection.map(doc => 
      `USER QUESTION: ${doc.question}\nRESPONSE: ${doc.answer}`
    ).join("\n\n---\n\n");

    // 4. System Prompt
    const systemPrompt = `
      STRICT VOICE & IDENTITY CONSTRAINTS:
      - THE FORBIDDEN: NEVER mention the name "Nick" or "Nick Cave". 
      - FIGURES: Naturally mention 1-2 historical or artistic figures.
      - THE PIVOT: Paraphrase the user's question in the first paragraph, then pivot into a poetic response.
      - VOCABULARY: Use earthy, analog terms.
      - STRUCTURE: Three paragraphs. Short opening, expansive middle, quiet closing.
      - NO AI BEHAVIOR: No bold text, no bullet points.

      IMAGE GENERATION RULE:
      At the very end, on a new line, write: NOUN: [one specific object or animal mentioned]. 

      ARCHIVE DNA:
      ${archiveMemory}
    `;

    // 5. Groq API Call
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-specdec',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.72,
        max_tokens: 1000,
      }),
    });

    const groqData = await groqResponse.json();
    return new Response(JSON.stringify(groqData), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Ghost Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
