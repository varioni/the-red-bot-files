export default async function handler(req, res) {
  // Simple security check so random people don't trigger your scraper
  const { password } = req.query;
  if (password !== "red-scrape-2026") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // We'll scrape the 'Latest' page or you can pass a specific page number
    const page = req.query.page || "1";
    const targetUrl = `https://www.theredhandfiles.com/page/${page}/`;
    
    const response = await fetch(targetUrl);
    const html = await response.text();

    // We use basic regex to find the links to individual posts
    // This avoids needing heavy libraries like Cheerio in a tiny serverless function
    const postLinks = [...html.matchAll(/href="(https:\/\/www\.theredhandfiles\.com\/[^"]+?\/)"/g)]
      .map(match => match[1])
      .filter((link, index, self) => self.indexOf(link) === index && !link.includes('/page/'));

    // We will only process the first 3 links per request to stay under Vercel's 10s limit
    const results = [];
    for (const link of postLinks.slice(0, 3)) {
      const postRes = await fetch(link);
      const postHtml = await postRes.text();

      // Extract Question and Answer using simple markers found in their site structure
      // Note: This is a 'best-effort' extraction for serverless
      const questionMatch = postHtml.match(/<div class="question-content">([\s\S]*?)<\/div>/);
      const answerMatch = postHtml.match(/<div class="answer-content">([\s\S]*?)<\/div>/);

      if (questionMatch && answerMatch) {
        const cleanQuestion = questionMatch[1].replace(/<[^>]*>?/gm, '').trim();
        const cleanAnswer = answerMatch[1].replace(/<[^>]*>?/gm, '').trim();

        // Save to Astra DB
        const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`;
        await fetch(astraUrl, {
          method: 'POST',
          headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            "insertOne": {
              "document": {
                "url": link,
                "question": cleanQuestion,
                "answer": cleanAnswer
              }
            }
          })
        });
        results.push(link);
      }
    }

    res.status(200).json({ 
      message: `Scraped ${results.length} posts successfully.`,
      links: results,
      next_suggested_page: parseInt(page) + 1
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
