export default async function handler(req, res) {
  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
    let allDocuments = [];
    let nextPageState = null;

    // Loop until we've gathered every document with a noun
    do {
      const requestBody = { 
        "find": { 
          "filter": { "noun": { "$exists": true, "$ne": "" } },
          "options": { "limit": 1000 }
        } 
      };
      
      if (nextPageState) {
        requestBody.find.options.pageState = nextPageState;
      }

      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const astraData = await astraRes.json();
      const docs = astraData?.data?.documents || [];
      allDocuments = allDocuments.concat(docs);
      
      // Check if there's another page of data to fetch
      nextPageState = astraData?.data?.nextPageState;

    } while (nextPageState);

    const counts = {};
    allDocuments.forEach(doc => {
      const noun = doc.noun.toLowerCase().trim();
      counts[noun] = (counts[noun] || 0) + 1;
    });

    const cloudData = Object.keys(counts)
      .map(word => ({
        text: word,
        size: 24 + (counts[word] * 15) 
      }))
      .sort((a, b) => b.size - a.size);

    res.status(200).json(cloudData);
  } catch (err) {
    res.status(500).json({ error: "The cloud remains out of reach." });
  }
}
