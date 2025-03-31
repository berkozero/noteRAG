import express from 'express';
import { hybridSearchWithLLM, enhanceWithContext } from '../utils/langchain-store.js';

const router = express.Router();

/**
 * Enhanced semantic search API with LLM query expansion, hybrid search, and context
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
    
    const limit = parseInt(req.query.limit) || 5;
    
    // Dynamic threshold is now handled inside hybridSearchWithLLM
    console.log(`Processing search query: "${q}"`);
    
    // Use LLM-enhanced hybrid search for better results, especially for short queries
    const results = await hybridSearchWithLLM(q, limit);
    
    // Enhance results with related context
    const enhancedResults = await enhanceWithContext(results, q);
    
    console.log(`Search for "${q}" returned ${enhancedResults.length} results`);
    
    res.json({
      success: true,
      query: q,
      results: enhancedResults.map(result => ({
        ...result,
        score: Math.round(result.score * 10000) / 100, // Convert to percentage
        matchDetails: {
          ...result.matchDetails,
          vectorScore: Math.round(result.matchDetails.vectorScore * 10000) / 100,
          keywordScore: Math.round(result.matchDetails.keywordScore * 10000) / 100
        }
      }))
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