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
    const embedding = queryEmbeddings[0];
    const allItems = Array.from(this.items.values());
    
    // Calculate simple similarity scores (this is a very basic approximation)
    const scoredItems = allItems.map(item => {
      let score = 0;
      // Simple character overlap score
      const itemChars = new Set(item.document.toLowerCase().split(''));
      const queryChars = new Set(embedding.slice(0, 10).map(n => String.fromCharCode(Math.floor(n * 255))));
      
      // Intersection size divided by union size (Jaccard similarity)
      const intersection = new Set([...itemChars].filter(x => queryChars.has(x)));
      const union = new Set([...itemChars, ...queryChars]);
      score = intersection.size / union.size;
      
      return {
        id: item.id,
        score,
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

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'NoteRAG Semantic API Server', 
    status: 'running',
    chromaStatus: notesCollection === inMemoryCollection ? 'fallback' : 'connected',
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

// Admin dashboard route
app.get('/admin', async (req, res) => {
  try {
    const collection = getCollection();
    const itemCount = await collection.count();
    const query = req.query.q || '';
    let searchResults = [];
    
    // Debug environment variables
    console.log('ADMIN ROUTE DEBUG:');
    console.log(`USE_OPENAI value: "${process.env.USE_OPENAI}"`);
    console.log(`OPENAI_API_KEY exists: ${Boolean(process.env.OPENAI_API_KEY)}`);
    console.log(`OPENAI_API_KEY length: ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0}`);
    
    // Get all items (simplified for in-memory)
    let items = [];
    if (collection === inMemoryCollection) {
      items = Array.from(inMemoryCollection.items.values()).map(item => ({
        id: item.id,
        metadata: item.metadata,
        document: item.document.substring(0, 100) + '...',
        hasEmbedding: !!item.embedding
      }));
      
      // If search query is provided, perform a search
      if (query) {
        const { generateEmbedding } = await import('./utils/embeddings.js');
        const embedding = await generateEmbedding(query);
        const results = await collection.query({
          queryEmbeddings: [embedding],
          nResults: 5
        });
        
        // Format search results
        if (results && results.ids && results.ids[0]) {
          searchResults = results.ids[0].map((id, index) => ({
            id,
            score: 1 - results.distances[0][index],
            metadata: results.metadatas[0][index],
            document: results.documents[0][index].substring(0, 100) + '...'
          }));
        }
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
          </style>
        </head>
        <body>
          <div class="container">
            <h1>NoteRAG Admin Dashboard</h1>
            
            <div class="stats">
              <h2>System Status</h2>
              <p><strong>Collection Type:</strong> ${collection === inMemoryCollection ? 'In-Memory Fallback' : 'ChromaDB'}</p>
              <p><strong>Note Count:</strong> ${itemCount}</p>
              <p><strong>OpenAI Status:</strong> <span class="${openaiStatus === 'Configured' ? 'status-good' : 'status-bad'}">${openaiStatus}</span></p>
              <p><strong>Embedding Model:</strong> ${embeddingModel}</p>
            </div>
            
            <h2>Test Semantic Search</h2>
            <form action="/admin" method="get">
              <input type="text" name="q" placeholder="Enter search query..." value="${query}">
              <button type="submit">Search</button>
            </form>
            
            ${query ? `
              <div class="search-results">
                <h3>Search Results for: "${query}"</h3>
                ${searchResults.length === 0 ? '<p>No results found.</p>' : ''}
                ${searchResults.map(result => `
                  <div class="note-card">
                    <h3>${result.metadata.title || 'Untitled Note'}</h3>
                    <p class="note-meta">ID: ${result.id}</p>
                    <p class="note-meta">Score: <span class="score">${(result.score * 100).toFixed(2)}%</span></p>
                    <p class="note-meta">URL: ${result.metadata.url || 'No URL'}</p>
                    <h4>Content:</h4>
                    <pre>${result.document}</pre>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <h2>Stored Notes</h2>
            ${itemCount === 0 ? '<p>No notes found in the collection.</p>' : ''}
            ${items.map(item => `
              <div class="note-card">
                <h3>${item.metadata.title || 'Untitled Note'}</h3>
                <p class="note-meta">ID: ${item.id}</p>
                <p class="note-meta">URL: ${item.metadata.url || 'No URL'}</p>
                <p class="note-meta">Created: ${new Date(item.metadata.timestamp).toLocaleString()}</p>
                <p class="note-meta">Has Embedding: ${item.hasEmbedding ? 'Yes' : 'No'}</p>
                <h4>Content:</h4>
                <pre>${item.document}</pre>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><pre>${error.stack}</pre>`);
  }
});

// API routes
app.use('/api/embeddings', embedRoutes);
app.use('/api/search', searchRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
async function startServer() {
  // Initialize ChromaDB
  await initChroma();
  
  // Start Express server
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Using ${notesCollection === inMemoryCollection ? 'IN-MEMORY fallback' : 'ChromaDB'} for embeddings`);
  });
}

// Start everything
startServer().catch(console.error); 