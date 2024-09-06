import { createClient } from "@libsql/client";

// Create the client instance
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  const { PSI_API_KEY, SECURE_KEY } = process.env;
  const { key, url, commitHash } = req.query; // Query parameters
  const strategy = 'mobile';

  const d_id = req.headers['x-vercel-id'] || '';

  // Validate the provided secure key
  if (key !== SECURE_KEY) {
    return res.status(403).json({ error: 'Unauthorized access' });
  }

  let is_live

  // Commit hash required to store the data
  if (!commitHash) {
    is_live = 'true'
  } else {
    is_live = 'false'
    commitHash = '0'
  }

  const categories = ['PERFORMANCE', 'BEST_PRACTICES', 'ACCESSIBILITY', 'SEO'];

  // Function to fetch data for a specific category and extract the score
  const fetchCategoryData = async (category) => {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${url}&key=${PSI_API_KEY}&strategy=${strategy}&category=${category}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API call for ${category} failed with status ${response.status}`);
    }

    const data = await response.json();

    // Extract the score based on the category
    const scores = {
      PERFORMANCE: data.lighthouseResult.categories.performance?.score * 100,
      BEST_PRACTICES: data.lighthouseResult.categories['best-practices']?.score * 100,
      ACCESSIBILITY: data.lighthouseResult.categories.accessibility?.score * 100,
      SEO: data.lighthouseResult.categories.seo?.score * 100
    };

    // Return the score for the requested category
    return scores[category];
  };

  try {
    // Trigger fetch requests for all categories concurrently using Promise.all
    const results = await Promise.all(categories.map(fetchCategoryData));

    console.log('results: '+ results)

    console.log('d_id: '+ d_id)

    // Prepare data to insert into the database
    const data = {
      url: url.toString(),
      deployment_id: d_id.toString(), // Leave blank for cron job scenario
      commit_hash: commitHash.toString(),
      live: is_live.toString(), // Set to false for webhook trigger
      performance: results[0].toString(),
      best_practices: results[1].toString(),
      accessibility: results[2].toString(),
      seo: results[3].toString(),
    };

    // Insert data into the database
    await client.execute({
      sql: `
        INSERT INTO pagespeed (url, deployment_id, commit_hash, live, performance, best_practices, accessibility, seo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      args: [
        data.url,
        data.deployment_id,
        data.commit_hash,
        data.live,
        data.performance,
        data.best_practices,
        data.accessibility,
        data.seo
      ],
    });

    // Send response
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching PageSpeed Insights data:', error);
    res.status(500).json({ error: 'Failed to fetch PageSpeed Insights data' });
  }
}
