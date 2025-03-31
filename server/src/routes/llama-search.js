import express from 'express';
import { initLlamaIndex, searchWithLlamaIndex } from '../utils/vector-store/index.js';

const router = express.Router();

/**
 * LlamaIndex-powered semantic search API with hybrid search
 * GET /api/llama-search?q=your search query
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
    const threshold = parseFloat(req.query.threshold) || 0.1; // Lower default threshold for LlamaIndex
    
    console.log(`Processing LlamaIndex search query: "${q}"`);
    
    // Use LlamaIndex-powered search
    const results = await searchWithLlamaIndex(q, limit, threshold);
    
    console.log(`LlamaIndex search for "${q}" returned ${results.length} results`);
    
    res.json({
      success: true,
      query: q,
      threshold,
      engine: 'llamaindex',
      results: results.map(result => ({
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
    console.error('LlamaIndex search error:', error);
    res.status(500).json({ 
      error: 'Failed to perform LlamaIndex search',
      message: error.message 
    });
  }
});

export default router; 