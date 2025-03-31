import express from 'express';
import { getCollection } from '../index.js';
import { generateEmbedding } from '../utils/embeddings.js';

const router = express.Router();

// Similarity threshold - only show results above this score
const SIMILARITY_THRESHOLD = 0.20;

/**
 * Semantic search API
 * GET /api/search?q=your search query
 */
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ 
        error: 'Missing required query parameter: q' 
      });
    }
    
    const collection = getCollection();
    const limit = parseInt(req.query.limit) || 5;
    
    // Generate embedding for the query text using OpenAI
    console.log(`Generating query embedding for: "${q}"`);
    const queryEmbedding = await generateEmbedding(q);
    
    // Search the collection using the embedding
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: Math.max(limit * 2, 10) // Get more results than needed for filtering
    });
    
    // Format the results for the API response
    const formattedResults = [];
    
    if (results && results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        // Calculate similarity score
        const similarity = 1 - (results.distances[0][i] || 0);
        
        // Only include results above threshold
        if (similarity >= SIMILARITY_THRESHOLD) {
          console.log(`Result ${i+1}: id=${results.ids[0][i]}, score=${similarity.toFixed(4)} ✓ (above threshold)`);
          
          formattedResults.push({
            id: results.ids[0][i],
            score: similarity,
            metadata: results.metadatas[0][i],
            content: results.documents[0][i]
          });
        } else {
          console.log(`Result ${i+1}: id=${results.ids[0][i]}, score=${similarity.toFixed(4)} ✗ (below threshold)`);
        }
      }
    }
    
    console.log(`Search for "${q}" returned ${formattedResults.length} results after threshold filtering`);
    
    res.json({
      success: true,
      query: q,
      threshold: SIMILARITY_THRESHOLD,
      results: formattedResults.slice(0, limit) // Apply original limit after filtering
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Failed to perform search',
      message: error.message 
    });
  }
});

export default router; 