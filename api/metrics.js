const chromeLambda = require('chrome-aws-lambda');
const puppeteerCore = require('puppeteer-core');
const logger = require('lighthouse-logger');

// Define flags and logger
const flags = { logLevel: 'info', output: 'json' };
logger.setLevel(flags.logLevel);

// Function to launch browser
const getBrowser = async () => {
  return puppeteerCore.launch({
    args: chromeLambda.args,
    defaultViewport: chromeLambda.defaultViewport,
    executablePath: await chromeLambda.executablePath,
    headless: true,
  });
};

// Handler function
module.exports = async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ error: 'No URL provided' });
  }

  console.log(`Starting request for URL :: ${url}`);

  const executablePath = await chromeLambda.executablePath;
console.log(`Executable Path: ${executablePath}`);

  const browser = await getBrowser();
  const endpoint = browser.wsEndpoint();
  const port = endpoint.split(':')[2].split('/')[0];

  console.log(`Endpoint :: ${endpoint}`);
  console.log(`Port :: ${port}`);
  console.log('Starting test run...');

  // Dynamically import lighthouse
  try {
    const { default: lighthouse } = await import('lighthouse');
    
    const config = {
      extends: 'lighthouse:default',
    };

    const results = await lighthouse(url, { ...flags, port }, config);
    console.log('Test run complete!');

    await browser.close();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60');

    // Extract key scores from results
    const report = JSON.parse(results.report);
    const { performance, accessibility, 'best-practices': bestPractices, seo } = report.categories;
    const scores = {
      performance: performance.score * 100,
      accessibility: accessibility.score * 100,
      bestPractices: bestPractices.score * 100,
      seo: seo.score * 100,
    };

    return res.status(200).json(scores);
  } catch (error) {
    console.error('Error running Lighthouse:', error);
    return res.status(500).json({ error: 'Error running Lighthouse', details: error.message });
  }
};
