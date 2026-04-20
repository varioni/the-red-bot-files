export default async function handler(req, res) {
  try {
    // 1. Fetch the main archive page with a "Real Person" header
    const targetUrl = "https://www.theredhandfiles.com/archive/";
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const html = await response.text();

    // 2. Refined Regex
    // This finds links that are likely issues while ignoring "about", "archive", etc.
    const issueRegex = /href="(https:\/\/www\.theredhandfiles\.com\/(?!archive|about|privacy|contact)[^"]+?\/)"/g;
    const matches = [...html.matchAll(issueRegex)];
    
    // Get the most recent 3 unique links
    const latestLinks = [...new Set(matches.map(m => m[1]))].slice(0, 3); 

    let addedCount = 0;

    for (const link of latestLinks) {
      // 3. Check Astra for duplicates
      const checkRes = await fetch(`${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "filter": { "url": link } } })
      });
      const checkData = await checkRes.json();

      if (checkData?.data?.documents?.length === 0) {
        // 4. Fetch the specific issue
        const issuePage = await fetch(link, {
           headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const issueHtml = await issuePage.text();
        
        // 5. Better Content Extraction
        // WordPress sites usually put the meat inside "entry-content" or "post-content"
        const contentMatch = issueHtml.match(/<div class="entry-content">([\s\S]*?)<\/div>/) || 
                             issueHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/);
        
        if (contentMatch) {
            // Remove HTML tags, script blocks, and excessive whitespace
            let cleanBody = contentMatch[1]
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<[^>]*>?/gm, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (cleanBody) {
              // 6. Push to Astra
              await fetch(`${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`, {
                method: 'POST',
                headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  "insertOne": {
                    "document": {
                      "url": link,
                      "answer": cleanBody.substring(0, 8000), // Increased limit slightly
                      "question": "A newly gathered ghost from the archive."
                    }
                  }
                })
              });
              addedCount++;
            }
        }
      }
    }

    res.status(200).json({ success: true, message: `Sync complete. Added ${addedCount} new documents.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
