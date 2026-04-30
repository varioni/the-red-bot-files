export default async function handler(req, res) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const key = searchParams.get('key');
    if (!key || key !== process.env.PURGE_KEY) return res.status(403).json({ error: "Forbidden" });

    const urlParts = req.url.split('?')[0].split('/');
    const keyword = urlParts[urlParts.length - 1].toLowerCase();

    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
    let allDocs = [];
    let nextState = null;

    // Fetch EVERYTHING first
    do {
      const body = { "find": { "options": { "limit": 1000 } } };
      if (nextState) body.find.options.pageState = nextState;
      
      const res = await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      allDocs = allDocs.concat(data?.data?.documents || []);
      nextState = data?.data?.nextPageState;
    } while (nextState);

    const toDelete = allDocs.filter(doc => {
      const content = `${doc.question} ${doc.answer} ${doc.noun || ""}`.toLowerCase();
      return content.includes(keyword);
    });

    for (const doc of toDelete) {
      await fetch(astraUrl, {
        method: 'POST',
        headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ "deleteOne": { "filter": { "_id": doc._id } } })
      });
    }

    res.status(200).json({ status: "Success", target: keyword, deleted: toDelete.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
}
