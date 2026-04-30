export default async function handler(req, res) {
  try {
    const targetUrl = "https://www.theredhandfiles.com/";
    const response = await fetch(targetUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();

    // 1. Better Link Extraction
    const rawLinks = [...html.matchAll(/href=["']([^"']+)["']/g)].map(m => m[1]);
    
    // A more aggressive blacklist to ignore the "noise" seen in your last run
    const blacklist = [
      'google-analytics', 'google.com', 'facebook.com', 'twitter.com', 'instagram.com',
      'page/', '/feed/', 'wp-content', 'wp-includes', 'shop', 'contact', 'privacy', 
      'about', 'terms', 'archive', '?', '#', 'category/', 'tag/'
    ];
    
    const latestLinks = rawLinks
      .filter(link => {
        // Must be an internal path and NOT on the blacklist
        const isInternal = (link.startsWith('/') && !link.startsWith('//')) || link.includes('theredhandfiles.com');
        const isBlacklisted = blacklist.some(word => link.toLowerCase().includes(word));
        const isHome = link === '/' || link === 'https://www.theredhandfiles.com/';
        return isInternal && !isBlacklisted && !isHome;
      })
      .map(link => link.startsWith('/') ? `https://www.theredhandfiles.com${link}` : link);

    const uniqueLinks = [...new Set(latestLinks)].slice(0, 5);

    let addedCount = 0;
    let history = [];
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;

    for (const link of uniqueLinks) {
      // 2. Duplicate Check
      const checkRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "filter": { "url": link } } })
      });
      const checkData = await checkRes.json();

      if (checkData?.data?.documents?.length === 0) {
        // 3. Fetch the Letter
        const issuePage = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const issueHtml = await issuePage.text();
        
        // 4. Targeted Content Extraction
        // Nick Cave's letters are usually inside a div with class "post-content" or "entry-content"
        const contentMatch = issueHtml.match(/<div class="[^"]*post-content[^"]*">([\s\S]*?)<\/div>/i) || 
                             issueHtml.match(/<div class="[^"]*entry-content[^"]*">([\s\S]*?)<\/div>/i) ||
                             issueHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
        
        if (contentMatch) {
          let cleanBody = contentMatch[1]
            .replace(/<script[\s\S]*?<\/script>/gi, '') 
            .replace(/<style[\s\S]*?<\/style>/gi, '')   
            .replace(/<[^>]*>?/gm, '') // Strip all remaining tags
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (cleanBody.length > 500) { // Letters are usually long; this avoids junk
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
          } else {
            history.push(`REJECTED: Content too short (${cleanBody.length} chars) at ${link}`);
          }
        } else {
          history.push(`FAILED: No content container found for ${link}`);
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
