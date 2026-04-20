export default async function handler(req, res) {
  const { password, page = "1" } = req.query;
  if (password !== "red-scrape-2026") return res.status(401).json({ error: "Unauthorized" });

  try {
    // 1. Visit the archive index page (e.g., /page/2/)
    const targetUrl = `https://www.theredhandfiles.com/page/${page}/`;
    const response = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36" }
    });
    const html = await response.text();

    // 2. Extract specific article links (slugs) from the feed
    // We look for links inside the "posts__article" structure
    const postLinks = [...html.matchAll(/href="(https:\/\/www\.theredhandfiles\.com\/([^"\/]+?)\/)"/g)]
      .map(match => match[1])
      .filter((link, index, self) => 
        self.indexOf(link) === index && 
        link.length > 35 && 
        !link.includes('/page/') &&
        !link.includes('/about/') &&
        !link.includes('/ask-a-question/')
      );

    const saved = [];

    // 3. Visit each found slug and extract data using the classes you found
    for (const link of postLinks.slice(0, 4)) { // Batch of 4 to stay under 10s
      const postRes = await fetch(link, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      const postHtml = await postRes.text();

      // Use the selectors from your Inspect session
      const titleBlock = postHtml.match(/<div class="post__title-block">([\s\S]*?)<\/div>/i);
      const articleBody = postHtml.match(/<div class="article">([\s\S]*?)<p style="text-align: center;">/i);

      if (titleBlock && articleBody) {
        // Extract the actual H1 question
        const qContent = titleBlock[1].match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        let cleanQ = qContent ? qContent[1] : "";
        
        // Clean the answer text
        let cleanA = articleBody[1].replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
        
        // Remove greetings/signatures
        cleanA = cleanA.replace(/^Dear .*?,/i, '').replace(/Love, Nick$/i, '').trim();
        cleanQ = cleanQ.replace(/<[^>]*>?/gm, '').trim();

        if (cleanQ && cleanA.length > 50) {
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
                  "scraped_at": new Date().toISOString()
                }
              }
            })
          });
          saved.push(link.split('/').filter(Boolean).pop()); // Just the slug name
        }
      }
    }

    res.status(200).json({ 
      status: "success", 
      scraped_count: saved.length, 
      items: saved,
      next_page_to_try: parseInt(page) + 1 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
