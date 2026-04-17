export default async function handler(req, res) {
  try {
    // 1. Fetch the main archive page from the real site
    const targetUrl = "https://www.theredhandfiles.com/archive/";
    const response = await fetch(targetUrl);
    const html = await response.text();

    // 2. Simple Regex to find the latest issue links
    // This looks for patterns like href="https://www.theredhandfiles.com/issue-number/"
    const issueRegex = /href="(https:\/\/www\.theredhandfiles\.com\/issue-.*\/)"/g;
    const matches = [...html.matchAll(issueRegex)];
    const latestLinks = [...new Set(matches.map(m => m[1]))].slice(0, 3); // Get top 3

    let addedCount = 0;

    for (const link of latestLinks) {
      // 3. Check Astra to see if we already have this URL
      const checkRes = await fetch(`${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "filter": { "url": link } } })
      });
      const checkData = await checkRes.json();

      if (checkData?.data?.documents?.length === 0) {
        // 4. It's a new issue! Fetch the actual content
        const issuePage = await fetch(link);
        const issueHtml = await issuePage.text();
        
        // Very basic extraction of the "Answer" block
        const bodyMatch = issueHtml.match(/<div class="entry-content">([\s\S]*?)<\/div>/);
        const cleanBody = bodyMatch ? bodyMatch[1].replace(/<[^>]*>?/gm, '').trim() : "";

        if (cleanBody) {
          // 5. Push to Astra
          await fetch(`${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`, {
            method: 'POST',
            headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              "insertOne": {
                "document": {
                  "url": link,
                  "answer": cleanBody.substring(0, 5000), // Keeping it under limit
                  "question": "A newly synced letter"
                }
              }
            })
          });
          addedCount++;
        }
      }
    }

    res.status(200).json({ success: true, message: `Sync complete. Added ${addedCount} new letters.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
