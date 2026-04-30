export default async function handler(req, res) {
  try {
    // 1. Target the actual homepage
    const targetUrl = "https://www.theredhandfiles.com/";
    
    const response = await fetch(targetUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      }
    });
    const html = await response.text();

    // 2. Identify the latest letters
    // This regex looks for links that are NOT common site pages (about, privacy, etc.)
    const linkRegex = /href="(https:\/\/www\.theredhandfiles\.com\/(?!about|privacy|contact|category|tag|terms|archive)[^"\/]+?\/)"/g;
    const matches = [...html.matchAll(linkRegex)];
    
    // We take the top 3 unique links found on the homepage
    const latestLinks = [...new Set(matches.map(m => m[1]))].slice(0, 3);

    let addedCount = 0;
    let details = [];
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;

    for (const link of latestLinks) {
      // 3. Duplicate Check
      const checkRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "filter": { "url": link } } })
      });
      const checkData = await checkRes.json();

      if (checkData?.data?.documents?.length === 0) {
        // 4. Fetch and Parse the specific Letter
        const issuePage = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const issueHtml = await issuePage.text();
        
        // We look for the main article body
        const bodyMatch = issueHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i) || 
                          issueHtml.match(/<div class="[^"]*content[^"]*">([\s\S]*?)<\/div>/i);
        
        if (bodyMatch) {
          let cleanBody = bodyMatch[1]
            .replace(/<script[\s\S]*?<\/script>/gi, '') 
            .replace(/<style[\s\S]*?<\/style>/gi, '')   
            .replace(/<[^>]*>?/gm, '')                  
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')                       
            .trim();

          if (cleanBody.length > 300) {
            // 5. Store in AstraDB
            await fetch(astraUrl, {
              method: 'POST',
              headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                "insertOne": {
                  "document": {
                    "url": link,
                    "answer": cleanBody.substring(0, 15000),
                    "question": "A newly gathered ghost from the archive.",
                    "synced_at": new Date().toISOString()
                  }
                }
              })
            });
            addedCount++;
            details.push(`Captured: ${link}`);
          }
        }
      } else {
        details.push(`Already in Archive: ${link}`);
      }
    }

    res.status(200).json({ 
      success: true, 
      added: addedCount, 
      scanned: latestLinks.length,
      history: details 
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
