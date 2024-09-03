// api/metrics.js
import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import { URL } from 'url';

export default async function handler(req, res) {
  try {
    const { url, commitHash } = req.query;
    if (!url || !commitHash) {
      return res.status(400).json({ error: 'URL and commitHash query parameters are required' });
    }

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    });

    const { port } = new URL(browser.wsEndpoint());
    const result = await lighthouse(url, { port }, 'json');
    await browser.close();

    const report = JSON.parse(result.report);
    const scores = {
      performance: report.categories.performance.score * 100,
      accessibility: report.categories.accessibility.score * 100,
      'best-practices': report.categories['best-practices'].score * 100,
      seo: report.categories.seo.score * 100,
    };

    res.setHeader('Content-Type', 'application/json');
    res.json(scores);
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
