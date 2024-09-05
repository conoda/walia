export default async function handler(req, res) {
  const { PSI_API_KEY, SECURE_KEY } = process.env;
  const { key, url, commitHash } = req.query; // query parameters
  const strategy = 'mobile';

  // Validate the provided secure key
  if (key !== SECURE_KEY) {
    return res.status(403).json({ error: 'Unauthorized access' });
  }

  // Commit hash required to store the data
  if (!commitHash) {
    return res.status(403).json({ error: 'commit hash is required' });
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

    // Return an object with each category's score
    res.status(200).json({
      PERFORMANCE: results[0],
      BEST_PRACTICES: results[1],
      ACCESSIBILITY: results[2],
      SEO: results[3],
    });
  } catch (error) {
    // Handle errors
    console.error('Error fetching PageSpeed Insights data:', error);
    res.status(500).json({ error: 'Failed to fetch PageSpeed Insights data' });
  }
}
