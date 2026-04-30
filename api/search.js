export default async function handler(req, res) {
  const { tag } = req.query;
  if (!tag) return res.status(400).json({ error: "No theme specified." });

  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
    let matches = [];
    let nextPageState = null;

    do {
      const requestBody = { 
        "find": { 
          "filter": { "noun": tag.toLowerCase().trim() }
        } 
      };
      if (nextPageState) requestBody.find.options = { "pageState": nextPageState };

      const astraRes = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const astraData = await astraRes.json();
      const docs = astraData?.data?.documents || [];
      matches = matches.concat(docs);
      nextPageState = astraData?.data?.nextPageState;

    } while (nextPageState);

    res.status(200).json(matches);
  } catch (err) {
    res.status(500).json({ error: "Search failed." });
  }
}
