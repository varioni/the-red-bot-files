export default async function handler(req, res) {
  try {
    const targetUrl = "https://www.theredhandfiles.com/";
    
    // 1. Fetch homepage with browser-like headers
    const response = await fetch(targetUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      }
    });
    const html = await response.text();

    // 2. Identify Potential Post Links
    // We grab every href and then filter manually
    const allLinks = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    
    const blacklist = ['about', 'privacy', 'contact', 'category', 'tag', 'terms', 'archive', 'shop', 'wp-', '?', '#', 'facebook', 'twitter', 'instagram'];
    
    const latestLinks = allLinks
      .filter(link => {
        // Must be a path on the same site
        const isInternal = link.startsWith('/') || link.includes('theredhandfiles.com');
        // Must not be in our blacklist
        const isSystemPage = blacklist.some(word => link.toLowerCase().includes(word));
        // Homepage itself is not a post
        const isHome = link === '/' || link === 'https://www.theredhandfiles.com/';
        
        return isInternal && !isSystemPage && !isHome;
      })
      .map(link => {
        // Normalize to absolute URLs
        if (link.startsWith('/')) return `https://www.theredhandfiles.com${link}`;
        return link;
      });

    // Take the top 5 unique potential letters
    const uniqueLinks = [...new Set(latestLinks)].slice(0, 5);

    let addedCount = 0;
    let history = [];
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;

    for (const link of uniqueLinks) {
      // 3. Duplicate Check
      const checkRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "filter": { "url": link } } })
      });
      const checkData = await checkRes.json();

      if (checkData?.data?.documents?.length === 0) {
        // 4. Fetch the post content
        const issuePage = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const issueHtml = await issuePage.text();
        
        // Use a generic content selector fallback
        const bodyMatch = issueHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i) || 
                          issueHtml.match(/<div class="[^"]*content[^"]*">([\s\S]*?)<\/div>/i) ||
                          issueHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
        
        if (bodyMatch) {
          let cleanBody = bodyMatch[1]
            .replace(/<script[\s\S]*?<\/script>/gi, '') 
            .replace(/<style[\s\S]*?<\/style>/gi, '')   
            .replace(/<[^>]*>?/gm, '')                  
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')                       
            .trim();

          if (cleanBody.length > 300) {
            // 5. Save to AstraDB
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
            history.push(`SUCCESS: ${link}`);
          }
        }
      } else {
        history.push(`EXISTS: ${link}`);
      }
    }

    res.status(200).json({ 
      success: true, 
      added: addedCount, 
      scanned: uniqueLinks.length,
      history: history 
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
