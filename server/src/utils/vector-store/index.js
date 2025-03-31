/**
 * Vector Store Module Index
 * 
 * Exports all functionality from the vector store modules.
 */

// Store initialization
export {
  initVectorStore,
  getVectorStore,
  isUsingChromaDB,
  setFallbackMode
} from './store-init.js';

// Document operations
export {
  addDocument,
  getAllDocuments,
  deleteDocument
} from './document-operations.js';

// Search operations
export {
  similaritySearch,
  hybridSearch,
  enhancedSearch,
  enhanceWithContext
} from './search-operations.js';

// LLM utilities
export {
  expandQuery,
  getDynamicThreshold,
  isTechnicalTerm,
  extractConcepts
} from './llm-utils.js';

// LlamaIndex implementation
export {
  initLlamaIndex,
  searchWithLlamaIndex,
  addDocumentToLlamaIndex,
  getAllDocumentsFromLlamaIndex,
  deleteDocumentFromLlamaIndex
} from './llamaindex-store.js'; 