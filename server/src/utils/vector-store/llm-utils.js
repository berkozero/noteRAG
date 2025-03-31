/**
 * LLM Utilities Module
 * 
 * Contains LLM-related functionality like query expansion and enhancements.
 */

/**
 * Use an LLM to expand short queries with related terms and concepts
 * @param {string} query - The original search query
 * @returns {Promise<string>} - The expanded query with related terms
 */
export async function expandQuery(query) {
  // Skip expansion for longer queries (5+ words) as they likely have enough context
  if (query.split(/\s+/).filter(w => w.length > 0).length >= 5) {
    console.log(`Query "${query}" is already detailed enough, skipping expansion`);
    return query;
  }

  try {
    console.log(`Expanding short query: "${query}" with LLM`);
    
    // Import OpenAI if needed
    const OpenAI = (await import('openai')).default;
    
    // Create OpenAI client instance
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Define the prompt for query expansion
    const prompt = `You are a search query expansion system.
Given the original search query, expand it with semantically related terms to improve retrieval.
Only return the expanded query WITHOUT explanations or additional text.
Original query: "${query}"
Expanded query:`;

    // Call the OpenAI API with the prompt
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You expand short search queries with related terms." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3, // Low temperature for more predictable results
      max_tokens: 100,
    });
    
    // Extract the expanded query from the response
    const expandedQuery = response.choices[0]?.message?.content?.trim() || query;
    
    console.log(`Expanded query: "${expandedQuery}"`);
    return expandedQuery;
  } catch (error) {
    console.error('Error expanding query with LLM:', error.message);
    // Return original query in case of error
    return query;
  }
}

/**
 * Calculate a dynamic threshold based on query length
 * @param {string} query - The search query
 * @param {number} defaultThreshold - Default threshold to use for longer queries
 * @returns {number} - The calculated threshold
 */
export function getDynamicThreshold(query, defaultThreshold = 0.2) {
  if (!query) return defaultThreshold;
  
  // Use lower thresholds for shorter queries
  if (query.length <= 3) return 0.08;
  if (query.length <= 6) return 0.12;
  return defaultThreshold;
}

/**
 * Check if a query contains a technical term that should get special handling
 * @param {string} query - The search query
 * @returns {boolean} - True if the query is a technical term
 */
export function isTechnicalTerm(query) {
  if (!query) return false;
  
  // List of important technical terms that should boost exact matches
  const technicalTerms = [
    'ai', 'ml', 'nlp', 'llm', 'rag', 'gpt', 'bert', 'transformer', 
    'neural', 'deep learning', 'machine learning', 'artificial intelligence'
  ];
  
  const lowerQuery = query.toLowerCase().trim();
  
  // Check if query matches any technical term
  return technicalTerms.some(term => 
    lowerQuery === term || 
    lowerQuery.includes(` ${term} `) || 
    lowerQuery.startsWith(`${term} `) || 
    lowerQuery.endsWith(` ${term}`)
  );
}

/**
 * Extract key concepts from text for graph-based context enhancement
 * @param {string} text - The text to extract concepts from
 * @returns {string[]} - Array of extracted concepts
 */
export function extractConcepts(text) {
  if (!text) return [];
  
  // Simple concept extraction (can be enhanced with NLP)
  return text
    .toLowerCase()
    .split(/[.,!?]/)
    .flatMap(sentence => 
      sentence
        .split(' ')
        .filter(word => word.length > 4)
    )
    .filter((v, i, a) => a.indexOf(v) === i);
} 