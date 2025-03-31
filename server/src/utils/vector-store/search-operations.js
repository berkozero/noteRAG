/**
 * Search Operations Module
 * 
 * Provides different search methods including basic similarity search,
 * hybrid search, and LLM-enhanced search.
 */

import { getVectorStore, setFallbackMode } from './store-init.js';
import { expandQuery, getDynamicThreshold, isTechnicalTerm, extractConcepts } from './llm-utils.js';

/**
 * Basic similarity search with error handling and fallback
 * @param {string} query Search query
 * @param {number} limit Maximum number of results
 * @param {number} threshold Minimum similarity threshold
 * @returns {Promise<Array>} Search results
 */
export async function similaritySearch(query, limit = 5, threshold = 0.2) {
  const vectorStore = getVectorStore();
  
  if (!vectorStore) {
    throw new Error('Vector store not initialized');
  }
  
  console.log(`Performing similarity search for: "${query}"`);
  
  try {
    // Get similarity search results
    const results = await vectorStore.similaritySearchWithScore(query, limit * 2);
    
    // Map results to a consistent format
    const mappedResults = results.map(([doc, score]) => ({
      id: doc.metadata.id,
      score: score,
      metadata: doc.metadata,
      content: doc.pageContent
    }));
    
    // Filter by threshold and limit results
    const filteredResults = mappedResults
      .filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    console.log(`Found ${filteredResults.length} results (filtered by threshold ${threshold})`);
    return filteredResults;
  } catch (error) {
    console.error('Error during similarity search:', error);
    
    // If error is due to ChromaDB connection, try to use in-memory store
    if (error.message && error.message.includes('ChromaConnectionError')) {
      console.log('ChromaDB connection error detected, falling back to in-memory storage for search');
      await setFallbackMode();
      
      // Try again with in-memory store
      return similaritySearch(query, limit, threshold);
    }
    
    throw error;
  }
}

/**
 * Hybrid search combining vector similarity with keyword matching
 * @param {string} query Search query
 * @param {number} limit Maximum number of results
 * @param {number} threshold Minimum similarity threshold
 * @returns {Promise<Array>} Hybrid search results
 */
export async function hybridSearch(query, limit = 5, threshold = 0.2) {
  const vectorStore = getVectorStore();
  
  if (!vectorStore) {
    throw new Error('Vector store not initialized');
  }

  console.log(`Performing hybrid search for: "${query}"`);

  try {
    // 1. Get vector similarity results
    const vectorResults = await vectorStore.similaritySearchWithScore(
      query,
      limit * 2 // Get more results for hybrid reranking
    );

    // 2. Extract keywords for keyword-based scoring
    const keywords = query.toLowerCase().split(/\W+/).filter(word => word.length > 2);
    
    // 3. Combine and rerank results
    const hybridResults = vectorResults.map(([doc, score]) => {
      // Calculate keyword match score
      const content = doc.pageContent.toLowerCase();
      const keywordScore = keywords.reduce((sum, keyword) => {
        const count = (content.match(new RegExp(keyword, 'g')) || []).length;
        return sum + (count > 0 ? (count * 0.1) : 0);
      }, 0);

      // Combine scores (70% vector, 30% keyword)
      const combinedScore = (score * 0.7) + (keywordScore * 0.3);

      return {
        id: doc.metadata.id,
        score: combinedScore,
        metadata: doc.metadata,
        content: doc.pageContent,
        matchDetails: {
          vectorScore: score,
          keywordScore: keywordScore,
          matchedKeywords: keywords.filter(k => content.includes(k))
        }
      };
    });

    // Filter and sort by combined score
    const results = hybridResults
      .filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`Hybrid search found ${results.length} results above threshold ${threshold}`);
    return results;
  } catch (error) {
    console.error('Error during hybrid search:', error);
    
    // If error is due to ChromaDB connection, try to use in-memory store
    if (error.message && error.message.includes('ChromaConnectionError')) {
      console.log('ChromaDB connection error detected, falling back to in-memory storage for search');
      await setFallbackMode();
      
      // Try again with in-memory store
      return hybridSearch(query, limit, threshold);
    }
    
    throw error;
  }
}

/**
 * Enhance search results with graph-based context
 * @param {Array} results Search results
 * @returns {Promise<Array>} Enhanced results with context
 */
export async function enhanceWithContext(results) {
  try {
    // Build a simple knowledge graph from results
    const graph = new Map();
    
    results.forEach(result => {
      // Extract key entities and concepts
      const concepts = extractConcepts(result.content);
      
      concepts.forEach(concept => {
        if (!graph.has(concept)) {
          graph.set(concept, new Set());
        }
        graph.get(concept).add(result.id);
      });
    });

    // Enhance results with related context
    return results.map(result => {
      const relatedDocs = findRelatedDocs(result, graph);
      return {
        ...result,
        enhancedContext: relatedDocs
      };
    });
  } catch (error) {
    console.error('Error enhancing context:', error);
    return results;
  }
}

/**
 * Helper function to find related documents
 * @param {Object} result Document result
 * @param {Map} graph Concept graph
 * @returns {Array} Related document IDs
 */
function findRelatedDocs(result, graph) {
  const related = new Set();
  
  // Find documents that share concepts
  extractConcepts(result.content).forEach(concept => {
    if (graph.has(concept)) {
      graph.get(concept).forEach(docId => {
        if (docId !== result.id) {
          related.add(docId);
        }
      });
    }
  });
  
  return Array.from(related);
}

/**
 * Enhanced hybrid search with LLM-based query expansion and technical term boosting
 * @param {string} query Search query
 * @param {number} limit Maximum number of results
 * @param {number} threshold Optional fixed threshold (overrides dynamic threshold)
 * @returns {Promise<Array>} Enhanced search results
 */
export async function enhancedSearch(query, limit = 5, threshold) {
  if (!query) {
    throw new Error('Query is required');
  }
  
  // Calculate dynamic threshold based on query length if not provided
  const dynamicThreshold = threshold || getDynamicThreshold(query);
  console.log(`Using dynamic threshold: ${dynamicThreshold} for query of length ${query.length}`);
  
  try {
    // For short queries, expand with LLM first
    const needsExpansion = query.length < 5 || query.split(/\s+/).length < 2;
    const expandedQuery = needsExpansion ? await expandQuery(query) : query;
    
    // Use hybrid search with the expanded query
    const results = await hybridSearch(expandedQuery, limit, dynamicThreshold);
    
    // Apply technical term boosting if needed
    if (isTechnicalTerm(query)) {
      console.log(`Technical term "${query}" detected, boosting exact matches`);
      
      // Apply boost to results that have exact match of the technical term
      const boostedResults = results.map(result => {
        const lowerContent = result.content.toLowerCase();
        const hasExactMatch = lowerContent.includes(query.toLowerCase());
        
        if (hasExactMatch) {
          // Boost score by up to 50% for exact matches of technical terms
          const boostFactor = 1.5;
          const newScore = Math.min(result.score * boostFactor, 1.0);
          console.log(`Boosting score for ${result.id} from ${result.score.toFixed(3)} to ${newScore.toFixed(3)}`);
          
          return {
            ...result,
            score: newScore,
            matchDetails: {
              ...result.matchDetails,
              boosted: true,
              boostFactor: boostFactor,
              reason: `Exact match for technical term "${query.toLowerCase()}"`
            }
          };
        }
        
        return result;
      });
      
      // Resort after boosting
      boostedResults.sort((a, b) => b.score - a.score);
      
      return boostedResults;
    }
    
    // If no special handling was needed, return the original results
    return results;
  } catch (error) {
    console.error('Error during enhanced search:', error);
    
    // Fallback to regular hybrid search if LLM expansion fails
    try {
      console.log('Falling back to standard hybrid search');
      return hybridSearch(query, limit, dynamicThreshold);
    } catch (fallbackError) {
      console.error('Fallback search also failed:', fallbackError);
      throw fallbackError;
    }
  }
} 