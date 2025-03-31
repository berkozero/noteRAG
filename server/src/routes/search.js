import express from 'express';
import { getCollection } from '../index.js';
import { generateEmbedding } from '../utils/embeddings.js';

const router = express.Router();

/**
 * Search for notes using semantic search
 * GET /api/search?q=your+search+query
 */
router.get('/', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const collection = getCollection();
    
    if (!collection) {
      console.warn('ChromaDB collection not available, returning empty results');
      return res.json({
        results: [],
        message: 'ChromaDB not available, using fallback'
      });
    }
    
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);
    
    // Search ChromaDB
    const searchResults = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: parseInt(limit, 10),
      includeMetadatas: true,
      includeDocuments: true,
      include: ["documents", "metadatas", "distances"]
    });
    
    // Process and return results
    const results = [];
    if (searchResults && searchResults.ids && searchResults.ids.length > 0) {
      const ids = searchResults.ids[0];
      const distances = searchResults.distances[0];
      const metadatas = searchResults.metadatas[0];
      const documents = searchResults.documents[0];
      
      for (let i = 0; i < ids.length; i++) {
        results.push({
          id: ids[i],
          score: 1 - distances[i], // Convert distance to similarity score (0-1)
          metadata: metadatas[i],
          content: documents[i]
        });
      }
    }
    
    res.json({
      success: true,
      query,
      results
    });
  } catch (error) {
    console.error('Error during semantic search:', error);
    res.status(500).json({ 
      error: 'Failed to perform semantic search',
      message: error.message 
    });
  }
});

export default router; 