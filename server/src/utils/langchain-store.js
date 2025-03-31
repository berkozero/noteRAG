/**
 * LangChain Vector Store Integration
 * 
 * This module provides integration with LangChain and ChromaDB for improved RAG capabilities.
 * It handles embedding generation and vector search with additional optimizations.
 * 
 * NOTE: This file is now a wrapper around a more modular implementation.
 * The actual functionality has been moved to separate modules for better maintainability.
 */

// Re-export everything from the modular implementation
export * from './vector-store/index.js';

// Create aliases for backward compatibility
import { enhancedSearch as hybridSearchWithLLM } from './vector-store/search-operations.js';
import { hybridSearch as advancedSearch } from './vector-store/search-operations.js';

// Export with backward-compatible names
export { hybridSearchWithLLM, advancedSearch }; 