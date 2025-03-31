/**
 * NoteRAG Semantic Search Server
 * 
 * This is a simple Express server that provides a semantic search API
 * for the NoteRAG Chrome extension.
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { ChromaClient } from 'chromadb';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { 
  initVectorStore, 
  getVectorStore, 
  similaritySearch, 
  isUsingChromaDB, 
  enhancedSearch,
  initLlamaIndex
} from './utils/langchain-store.js';

// Determine file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env
const result = dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (result.error) {
  console.warn('Error loading .env file:', result.error);
}

// Verify environment variables are loaded
console.log('DEBUG ENV VARS (index.js):');
console.log(`USE_OPENAI value: "${process.env.USE_OPENAI}"`);
console.log(`OPENAI_API_KEY exists: ${Boolean(process.env.OPENAI_API_KEY)}`);
console.log(`OPENAI_EMBEDDING_MODEL: "${process.env.OPENAI_EMBEDDING_MODEL}"`);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;
const THRESHOLD = 0.20; // Similarity threshold for search results

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Simple in-memory collection for testing without ChromaDB
const inMemoryCollection = {
  items: new Map(),
  add: async function({ ids, embeddings, metadatas, documents }) {
    for (let i = 0; i < ids.length; i++) {
      this.items.set(ids[i], {
        id: ids[i],
        embedding: embeddings[i],
        metadata: metadatas[i],
        document: documents[i]
      });
    }
    console.log(`[InMemory] Added ${ids.length} items`);
    return { success: true };
  },
  query: async function({ queryEmbeddings, nResults }) {
    const queryEmbedding = queryEmbeddings[0];
    const allItems = Array.from(this.items.values());
    
    // Calculate cosine similarity between query embedding and all items
    const scoredItems = allItems.map(item => {
      // If item doesn't have embedding, give a minimal score
      if (!item.embedding || !Array.isArray(item.embedding)) {
        return {
          id: item.id,
          score: 0.01, // Minimal score
          metadata: item.metadata,
          document: item.document
        };
      }
      
      // Calculate cosine similarity between embeddings
      let dotProduct = 0;
      let magA = 0;
      let magB = 0;
      
      // Use the smaller dimension if vectors are different lengths
      const length = Math.min(queryEmbedding.length, item.embedding.length);
      
      for (let i = 0; i < length; i++) {
        dotProduct += queryEmbedding[i] * item.embedding[i];
        magA += queryEmbedding[i] * queryEmbedding[i];
        magB += item.embedding[i] * item.embedding[i];
      }
      
      magA = Math.sqrt(magA);
      magB = Math.sqrt(magB);
      
      let similarity = 0;
      if (magA > 0 && magB > 0) {
        similarity = dotProduct / (magA * magB);
      }
      
      // Debug log so we can see the score
      console.log(`[InMemory] Item ${item.id} similarity: ${similarity}`);
      
      return {
        id: item.id,
        score: similarity,
        metadata: item.metadata,
        document: item.document
      };
    });
    
    // Sort by score (highest first) and limit to requested number
    const results = scoredItems
      .sort((a, b) => b.score - a.score)
      .slice(0, nResults);
    
    return {
      ids: [results.map(r => r.id)],
      distances: [results.map(r => 1 - r.score)], // Convert score to distance
      metadatas: [results.map(r => r.metadata)],
      documents: [results.map(r => r.document)]
    };
  },
  delete: async function({ ids }) {
    for (const id of ids) {
      this.items.delete(id);
    }
    console.log(`[InMemory] Deleted ${ids.length} items`);
    return { success: true };
  },
  count: async function() {
    return this.items.size;
  }
};

// Initialize ChromaDB client
export const chromaClient = new ChromaClient({
  path: process.env.CHROMA_DB_URL || 'http://localhost:8000'
});

// Collection name for notes
export const COLLECTION_NAME = 'noterag_notes';

// Initialize the collection
let notesCollection = inMemoryCollection; // Default to in-memory

async function initChroma() {
  try {
    console.log('Initializing ChromaDB collection...');
    // Try to get the collection, create if it doesn't exist
    try {
      const collection = await chromaClient.getCollection({
        name: COLLECTION_NAME
      });
      console.log('Collection exists, retrieved successfully');
      notesCollection = collection; // Use ChromaDB if available
    } catch (error) {
      // Try to create collection
      try {
        const collection = await chromaClient.createCollection({
          name: COLLECTION_NAME,
          metadata: { 
            description: 'Notes collection for NoteRAG application' 
          }
        });
        console.log('Created new collection');
        notesCollection = collection; // Use ChromaDB if available
      } catch (createError) {
        console.warn('Could not create ChromaDB collection, using in-memory fallback');
        // Keep using in-memory collection (already set as default)
      }
    }
    
    const itemCount = await notesCollection.count();
    console.log(`Collection has ${itemCount} items`);
    console.log('ChromaDB initialized successfully');
    return notesCollection;
  } catch (error) {
    console.error('Failed to initialize ChromaDB:', error);
    console.log('Using in-memory fallback collection');
    return inMemoryCollection; // Fallback to in-memory
  }
}

// Make collection available to routes
export const getCollection = () => notesCollection;

// Import routes - do this after exporting the functions they need
import embedRoutes from './routes/embeddings.js';
import searchRoutes from './routes/search.js';
import llamaSearchRoutes from './routes/llama-search.js';

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'NoteRAG Semantic API Server', 
    status: 'running',
    chromaStatus: isUsingChromaDB() ? 'connected' : 'fallback',
    openaiStatus: process.env.USE_OPENAI === 'true' && process.env.OPENAI_API_KEY ? 'configured' : 'not-configured' 
  });
});

// Add route for /api/ to prevent 404 errors
app.get('/api', (req, res) => {
  res.json({
    message: 'NoteRAG API v1',
    status: 'running',
    endpoints: ['/api/embeddings', '/api/search']
  });
});

// Add test data route
app.get('/api/test-data', async (req, res) => {
  try {
    const { generateEmbedding } = await import('./utils/embeddings.js');
    const collection = getCollection();
    
    // Sample test notes
    const testNotes = [
      {
        id: 'test-note-1',
        title: 'Machine Learning Fundamentals',
        text: 'Machine learning is a field of study that gives computers the ability to learn without being explicitly programmed. It focuses on developing algorithms that can learn from and make predictions on data.',
        url: 'https://example.com/ml',
        timestamp: Date.now() - 300000
      },
      {
        id: 'test-note-2',
        title: 'JavaScript Async Programming',
        text: 'Asynchronous programming in JavaScript allows operations to complete without blocking the main thread. Promises, async/await, and callbacks are common patterns for handling asynchronous code.',
        url: 'https://example.com/js-async',
        timestamp: Date.now() - 200000
      },
      {
        id: 'test-note-3',
        title: 'Nutrition and Health',
        text: 'A balanced diet rich in fruits, vegetables, whole grains, and lean proteins can help maintain good health. Proper nutrition is essential for energy, growth, and immune function.',
        url: 'https://example.com/nutrition',
        timestamp: Date.now() - 100000
      }
    ];
    
    // Add notes to collection with OpenAI embeddings
    for (const note of testNotes) {
      const content = `${note.title} ${note.text}`.trim();
      console.log(`Generating embeddings for test note: ${note.id}`);
      
      // Generate embedding
      const embedding = await generateEmbedding(content);
      
      // Add to collection
      await collection.add({
        ids: [note.id],
        embeddings: [embedding],
        metadatas: [{
          title: note.title,
          url: note.url,
          timestamp: note.timestamp,
          type: 'note'
        }],
        documents: [content]
      });
      
      console.log(`Added test note ${note.id} with embedding`);
    }
    
    res.json({
      success: true,
      message: `Added ${testNotes.length} test notes with embeddings`,
      noteIds: testNotes.map(n => n.id)
    });
  } catch (error) {
    console.error('Error adding test data:', error);
    res.status(500).json({ 
      error: 'Failed to add test data',
      message: error.message 
    });
  }
});

// Admin dashboard route
app.get('/admin', async (req, res) => {
  try {
    console.log('ADMIN ROUTE DEBUG:');
    console.log(`USE_OPENAI value: "${process.env.USE_OPENAI}"`);
    console.log(`OPENAI_API_KEY exists: ${Boolean(process.env.OPENAI_API_KEY)}`);
    console.log(`OPENAI_API_KEY length: ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0}`);
    
    // Get query parameter
    const query = req.query.q || '';
    const engine = req.query.engine || 'langchain'; // Default to LangChain
    
    // Show store type in UI
    const storeType = isUsingChromaDB() 
      ? 'LangChain ChromaDB' 
      : 'LangChain In-Memory';

    // Initialize search results and numerical flag
    let searchResults = [];
    let hasNumericalComparison = false;
    
    if (query) {
      try {
        // Check if query contains numerical comparison
        hasNumericalComparison = !!query.match(/(over|above|more than|exceeding|greater than|>)\s*\$?(\d+)([km]|mn|million|billion|bn)?/i);
        
        // Choose search engine based on parameter
        if (engine === 'llamaindex') {
          // Use LlamaIndex-powered search
          searchResults = await searchWithLlamaIndex(query, 5, 0.1);
        } else {
          // Use LLM-enhanced hybrid search for better results with short queries
          searchResults = await enhancedSearch(query, 5);
        }
      } catch (searchError) {
        console.error('Error during admin search:', searchError);
        // Keep searchResults empty but don't fail the entire response
      }
    }
    
    // OpenAI status
    const openaiStatus = process.env.USE_OPENAI === 'true' && process.env.OPENAI_API_KEY 
      ? 'Configured' 
      : 'Not Configured';
    const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    
    // Render a simple HTML dashboard
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>NoteRAG Admin</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
            .container { max-width: 1200px; margin: 0 auto; }
            h1 { margin-top: 0; }
            .stats { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .note-card { background: white; border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
            .note-meta { color: #666; font-size: 14px; }
            pre { white-space: pre-wrap; }
            form { margin-bottom: 20px; }
            input[type="text"] { padding: 8px; width: 300px; font-size: 16px; }
            button { padding: 8px 16px; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; }
            .search-results { margin-bottom: 30px; }
            .score { font-weight: bold; color: #0066cc; }
            .status-good { color: green; font-weight: bold; }
            .status-bad { color: orangered; font-weight: bold; }
            .score-debug { font-size: 12px; color: #888; margin-left: 5px; }
            .score-high { color: green; font-weight: bold; }
            .score-medium { color: orange; font-weight: bold; }
            .score-low { color: red; font-weight: bold; }
            .langchain-badge { background: #0066cc; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 8px; }
            .llamaindex-badge { background: #8a2be2; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 8px; }
            .special-search { background: #ffd700; color: black; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 8px; }
            .engine-selector { margin-bottom: 10px; }
            .engine-label { margin-right: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>NoteRAG Admin Dashboard <span class="langchain-badge">LangChain</span> <span class="llamaindex-badge">LlamaIndex</span></h1>
            
            <div class="stats">
              <h2>System Status</h2>
              <p><strong>Vector Store:</strong> ${storeType}</p>
              <p><strong>OpenAI Status:</strong> <span class="${openaiStatus === 'Configured' ? 'status-good' : 'status-bad'}">${openaiStatus}</span></p>
              <p><strong>Embedding Model:</strong> ${embeddingModel}</p>
            </div>
            
            <h2>Test Semantic Search</h2>
            <form action="/admin" method="get">
              <div class="engine-selector">
                <span class="engine-label">Search Engine:</span>
                <label>
                  <input type="radio" name="engine" value="langchain" ${engine === 'langchain' ? 'checked' : ''}> 
                  <span class="langchain-badge">LangChain</span>
                </label>
                <label>
                  <input type="radio" name="engine" value="llamaindex" ${engine === 'llamaindex' ? 'checked' : ''}>
                  <span class="llamaindex-badge">LlamaIndex</span>
                </label>
              </div>
              <input type="text" name="q" placeholder="Enter search query..." value="${query}">
              <button type="submit">Search</button>
            </form>
            
            ${query ? `
              <div class="search-results">
                <h3>Search Results for: "${query}" using ${engine === 'llamaindex' ? '<span class="llamaindex-badge">LlamaIndex</span>' : '<span class="langchain-badge">LangChain</span>'}</h3>
                <p class="threshold-info">Results include ${engine === 'llamaindex' ? 'LlamaIndex hybrid search' : 'LLM query expansion'}
                ${hasNumericalComparison ? ' <span class="special-search">• Numerical comparison detected - boosting results with higher amounts</span>' : ''}
                </p>
                ${searchResults.length === 0 ? '<p>No results found.</p>' : ''}
                ${searchResults.map(result => `
                  <div class="note-card">
                    <h3>${result.metadata.title || 'Untitled Note'}</h3>
                    <p class="note-meta">ID: ${result.id}</p>
                    <p class="note-meta">Score: <span class="score ${result.score >= 50 ? 'score-high' : result.score >= 30 ? 'score-medium' : 'score-low'}">${Math.round(result.score * 100) / 100}%</span> 
                      <span class="score-debug">(Raw: ${(result.score / 100).toFixed(6)})</span></p>
                    ${result.matchDetails && result.matchDetails.boosted ? 
                      `<p class="note-meta"><span class="special-search">★ Boosted: ${result.matchDetails.reason}</span></p>` : ''}
                    <p class="note-meta">URL: ${result.metadata.url || 'No URL'}</p>
                    <h4>Content:</h4>
                    <pre>${result.content}</pre>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <h2>Vector Store Integration</h2>
            <p>This system uses both LangChain and LlamaIndex for vector storage and semantic search.</p>
            <p><span class="langchain-badge">LangChain</span> provides optimized vector operations, better embedding management, and improved similarity calculations.</p>
            <p><span class="llamaindex-badge">LlamaIndex</span> adds advanced RAG capabilities like hybrid search, query decomposition, and metadata filtering.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><pre>${error.stack}</pre>`);
  }
});

// Add API routes
app.use('/api/embeddings', embedRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/llama-search', llamaSearchRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ 
    error: 'Server error', 
    message: err.message || 'Unknown error occurred'
  });
});

// Start server
async function startServer() {
  try {
    // Initialize LangChain vector store
    console.log('Initializing vector store...');
    await initVectorStore();
    console.log('Vector store initialization complete');
    
    // Initialize LlamaIndex (but don't block startup if it fails)
    try {
      console.log('Initializing LlamaIndex...');
      await initLlamaIndex();
      console.log('LlamaIndex initialization complete');
    } catch (llamaError) {
      console.warn('LlamaIndex initialization failed, this endpoint will not be available:', llamaError.message);
    }
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`Using LangChain with OpenAI embeddings (model: ${process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'})`);
      console.log(`Vector store: ${isUsingChromaDB() ? 'ChromaDB' : 'In-Memory Fallback with persistence'}`);
    });
  } catch (error) {
    console.error('Error during server startup:', error);
    
    // Exit with error if the vector store fails to initialize
    console.error('Failed to initialize vector store, exiting process');
    process.exit(1);
  }
}

// Start everything
startServer().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
}); 