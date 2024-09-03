import chrome from 'chrome-aws-lambda';

const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

export default async function handler(req, res) {
  try {
    const { url, commitHash } = req.query;
    if (!url || !commitHash) {
      return res.status(400).json({ error: 'URL and commitHash query parameters are required' });
    }

    // Create a key using the URL and commit hash
    const domain = new URL(url).hostname;
    const key = `lighthouse:${domain}:${commitHash}`;

    // Check if scores are already cached
    const response = await fetch(`${KV_REST_API_URL}/get/${key}`, {
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      },
    });
    const cachedScores = await response.json();

    if (cachedScores && cachedScores.data) {
      return res.json(cachedScores.data);
    }

    // Dynamically import Lighthouse
    const { default: lighthouse } = await import('lighthouse');

    // Launch headless Chrome
    const browser = await chrome.puppeteer.launch({
      args: chrome.args,
      executablePath: await chrome.executablePath,
      headless: chrome.headless,
    });

    // Run Lighthouse
    const { port } = new URL(browser.wsEndpoint());
    const result = await lighthouse(url, { port }, 'json');

    // Close the browser
    await browser.close();

    // Extract the key scores
    const report = JSON.parse(result.report);
    const scores = {
      performance: report.categories.performance.score * 100,
      accessibility: report.categories.accessibility.score * 100,
      'best-practices': report.categories['best-practices'].score * 100,
      seo: report.categories.seo.score * 100,
    };

    // Save scores to Vercel KV
    await fetch(`${KV_REST_API_URL}/set/${key}`, {
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({ data: scores }),
    });

    // Serve the scores
    res.setHeader('Content-Type', 'application/json');
    res.send(scores);
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}