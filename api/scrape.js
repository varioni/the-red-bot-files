export default async function handler(req, res) {
  const { password, page = "1" } = req.query;
  if (password !== "red-scrape-2026") return res.status(401).json({ error: "Unauthorized" });

  try {
    const targetUrl = `https://www.theredhandfiles.com/page/${page}/`;
    const response = await fetch(targetUrl);
    const html = await response.text();

    // 1. Find Issue links (e.g., issue-359 or feels-completely-meaningless)
    const postLinks = [...html.matchAll(/href="(https:\/\/www\.theredhandfiles\.com\/[^"]+?\/)"/g)]
      .map(match => match[1])
      .filter((link, index, self) => 
        self.indexOf(link) === index && 
        !link.includes('/page/') && 
        link !== 'https://www.theredhandfiles.com/'
      );

    const saved = [];
    for (const link of postLinks.slice(0, 3)) {
      const postRes = await fetch(link);
      const postHtml = await postRes.text();

      // 2. Targeted Extraction based on your 'Inspect' data
      const qBlock = postHtml.match(/<div class="post__title-block">([\s\S]*?)<\/div>/i);
      const aBlock = postHtml.match(/<div class="article">([\s\S]*?)<p style="text-align: center;"><a href="\/ask-a-question"/i);

      if (qBlock && aBlock) {
        // Clean Question: Strip Issue numbers and names, keep the core inquiry
        let cleanQ = qBlock[1].replace(/<h2[\s\S]*?<\/h2>/gi, '') // Remove "Issue #359"
                             .replace(/<h3[\s\S]*?<\/h3>/gi, '') // Remove User Name/Location
                             .replace(/<[^>]*>?/gm, '')         // Strip remaining tags
                             .trim();

        // Clean Answer: Get all paragraph text
        let cleanA = aBlock[1].replace(/<script[\s\S]*?<\/script>/gi, '') // Remove scripts
                             .replace(/<style[\s\S]*?<\/style>/gi, '')   // Remove styles
                             .replace(/<[^>]*>?/gm, '')                 // Strip all HTML tags
                             .replace(/&nbsp;/g, ' ')
                             .trim();

        // Optional: Remove standard salutations to keep the 'wisdom' dense
        cleanA = cleanA.replace(/^Dear .*?,/i, '')
                       .replace(/Love, Nick$/i, '')
                       .trim();

        const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`;
        await fetch(astraUrl, {
          method: 'POST',
          headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            "insertOne": {
              "document": {
                "url": link,
                "question": cleanQ,
                "answer": cleanA,
                "source": "RedHandFiles_Official"
              }
            }
          })
        });
        saved.push(link);
      }
    }

    res.status(200).json({ 
      status: "success", 
      scraped_count: saved.length, 
      links: saved,
      next_page: parseInt(page) + 1 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
