async function drawCloud() {
    const status = document.getElementById('status');
    const canvas = document.getElementById('cloud-canvas');
    const container = document.getElementById('cloud-container');

    // Set internal canvas resolution
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    try {
        const response = await fetch('/api/cloud-data');
        const data = await response.json();
        
        if (!data.text) throw new Error("No data");

        // 1. NLP NOUN EXTRACTION
        const doc = nlp(data.text);
        // Extracts only nouns and converts to array
        const nouns = doc.nouns().out('array');

        // 2. THEMATIC FILTER (Filler Killers)
        const exclusions = new Set([
            'thing', 'things', 'something', 'anything', 'really', 'actually', 
            'maybe', 'just', 'nothing', 'time', 'world', 'life', 'people', 
            'way', 'part', 'sense', 'kind', 'lot', 'question', 'answer'
        ]);

        const counts = {};
        nouns.forEach(n => {
            const word = n.toLowerCase().replace(/[^a-z]/g, '');
            if (word.length > 3 && !exclusions.has(word)) {
                counts[word] = (counts[word] || 0) + 1;
            }
        });

        // 3. CONVERT TO CLOUD FORMAT
        const cloudData = Object.entries(counts)
            .map(([text, count]) => [text, 18 + (count * 4)]) // Scaled size
            .sort((a, b) => b[1] - a[1])
            .slice(0, 80);

        // 4. RENDER
        WordCloud(canvas, {
            list: cloudData,
            gridSize: 8,
            weightFactor: 1,
            fontFamily: 'Courier New, monospace',
            color: '#2c2c2c',
            rotateRatio: 0,
            backgroundColor: 'transparent',
            drawOutOfBound: false
        });

        status.style.display = 'none';

    } catch (err) {
        console.error(err);
        status.innerText = "The themes are currently obscured.";
    }
}

window.addEventListener('load', drawCloud);
