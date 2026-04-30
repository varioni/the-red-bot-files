export default async function handler(req, res) {
  try {
    const targetUrl = "https://www.theredhandfiles.com/";
    
    // 1. Fetch with a more specific Chrome-on-Windows signature
    const response = await fetch(targetUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    const html = await response.text();

    // 2. Diagnostic: If HTML is empty or tiny, we are being blocked
    const htmlSize = html.length;

    // 3. Permissive Link Capture (Handles both " and ')
    const linkRegex = /href=["']([^"']+)["']/g;
    const rawLinks = [...html.matchAll(linkRegex)].map(m => m[1]);
    
    const blacklist = ['about', 'privacy', 'contact', 'category', 'tag', 'terms', 'archive', 'shop', 'wp-', '?', '#', 'facebook', 'twitter', 'instagram', 'linkedin'];
    
    const latestLinks = rawLinks
      .filter(link => {
        const isInternal = link.startsWith('/') || link.includes('theredhandfiles.com');
        const isBlacklisted = blacklist.some(word => link.toLowerCase().includes(word));
        const isHome = link === '/' || link === 'https://www.theredhandfiles.com/';
        return isInternal && !isBlacklisted && !isHome;
      })
      .map(link => {
        if (link.startsWith('/')) return `https://www.theredhandfiles.com${link}`;
        return link;
      });

    const uniqueLinks = [...new Set(latestLinks)].slice(0, 5);

    let addedCount = 0;
    let history = [];
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/archives`;

    for (const link of uniqueLinks) {
      const checkRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "find": { "filter": { "url": link } } })
      });
      const checkData = await checkRes.json();

      if (checkData?.data?.documents?.length === 0) {
        const issuePage = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const issueHtml = await issuePage.text();
        
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

          if (cleanBody.length > 200) {
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
      debug: {
        html_length: htmlSize,
        raw_links_found: rawLinks.length,
        filtered_links: latestLinks.length
      },
      history: history 
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
