export default async function handler(req, res) {
  const { password, page = "1" } = req.query;
  if (password !== "red-scrape-2026") return res.status(401).json({ error: "Unauthorized" });

  try {
    const targetUrl = `https://www.theredhandfiles.com/page/${page}/`;
    const response = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36" }
    });
    const html = await response.text();

    // Find links that look like Issue pages
    const postLinks = [...html.matchAll(/href="(https:\/\/www\.theredhandfiles\.com\/[^"]+?\/)"/g)]
      .map(match => match[1])
      .filter((link, index, self) => 
        self.indexOf(link) === index && 
        link.length > 40 && // Issue URLs are usually long
        !link.includes('/page/')
      );

    const saved = [];
    for (const link of postLinks.slice(0, 3)) {
      const postRes = await fetch(link, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36" }
      });
      const postHtml = await postRes.text();

      // NEW LOGIC: Just grab the first H1 and all paragraph text within the 'article' area
      const h1Match = postHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const articleMatch = postHtml.match(/<div class="article">([\s\S]*?)<div class="post__title-block">/i) || 
                           postHtml.match(/<div class="article">([\s\S]*?)<p style="text-align: center;">/i);

      if (h1Match && articleMatch) {
        let cleanQ = h1Match[1].replace(/<[^>]*>?/gm, '').trim();
        let cleanA = articleMatch[1].replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();

        // Strip the standard "Dear..." and "Love, Nick"
        cleanA = cleanA.replace(/^Dear .*?,/i, '').replace(/Love, Nick/i, '').trim();

        if (cleanQ.length > 5 && cleanA.length > 50) {
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
                  "batch": "stealth_v3"
                }
              }
            })
          });
          saved.push(link);
        }
      }
    }

    res.status(200).json({ 
      status: "success", 
      scraped: saved.length, 
      links: saved,
      next_page: parseInt(page) + 1 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
