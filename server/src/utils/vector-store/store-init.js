/**
 * Vector Store Initialization Module
 * 
 * Handles the configuration and initialization of vector stores
 * with appropriate fallback mechanisms.
 */

import { Chroma } from "@langchain/community/vectorstores/chroma";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// Determine file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Collection name
const COLLECTION_NAME = 'noterag_notes';

// Path for persisting in-memory store
const PERSISTENCE_PATH = path.resolve(__dirname, '../../../data/vector-store.json');

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
});

// Vector store state
let vectorStore = null;
let usingChromaDB = false;
let persistedDocuments = [];

/**
 * Load persisted vector store data
 * @returns {Promise<Array>} Array of persisted documents
 */
export async function loadPersistedData() {
  try {
    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(PERSISTENCE_PATH), { recursive: true });
    
    // Check if file exists
    const stats = await fs.stat(PERSISTENCE_PATH).catch(() => null);
    
    if (stats && stats.isFile()) {
      const data = await fs.readFile(PERSISTENCE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      console.log(`Loaded ${parsed.length} documents from persistent storage`);
      return parsed;
    }
  } catch (error) {
    console.warn('Error loading persisted data:', error.message);
  }
  
  return [];
}

/**
 * Save vector store data for persistence
 * @param {Array} documents Array of documents to persist
 */
export async function persistData(documents) {
  if (!documents || documents.length === 0) return;
  
  try {
    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(PERSISTENCE_PATH), { recursive: true });
    
    // Update our in-memory reference
    persistedDocuments = documents;
    
    // Write to disk
    await fs.writeFile(PERSISTENCE_PATH, JSON.stringify(documents, null, 2), 'utf8');
    console.log(`Persisted ${documents.length} documents to disk`);
  } catch (error) {
    console.error('Error persisting data:', error.message);
  }
}

/**
 * Create in-memory store as fallback
 * @returns {Promise<MemoryVectorStore>} Memory vector store
 */
async function createInMemoryStore() {
  console.log('Creating in-memory vector store with persistence...');
  const store = new MemoryVectorStore(embeddings);
  
  // Load any persisted documents
  persistedDocuments = await loadPersistedData();
  
  // Restore persisted documents if available
  if (persistedDocuments.length > 0) {
    console.log(`Restoring ${persistedDocuments.length} documents to in-memory store`);
    await store.addDocuments(persistedDocuments);
  } else {
    // Add a welcome document if no data exists
    await store.addDocuments([
      {
        pageContent: "Welcome to NoteRAG - A semantic search system for your notes",
        metadata: { id: "welcome", source: "system", title: "Welcome", timestamp: Date.now() }
      }
    ]);
  }
  
  console.log('In-memory vector store initialized successfully');
  return store;
}

/**
 * Initialize the vector store connection with fallback
 * @returns {Promise<Object>} Vector store instance
 */
export async function initVectorStore() {
  console.log('Initializing LangChain vector store...');
  
  // Load persisted documents first
  persistedDocuments = await loadPersistedData();
  
  // Check if ChromaDB should be skipped
  const skipChromaDB = process.env.USE_CHROMADB === 'false';
  
  if (skipChromaDB) {
    console.log('ChromaDB is disabled via USE_CHROMADB=false, using in-memory store directly');
    vectorStore = await createInMemoryStore();
    usingChromaDB = false;
    return vectorStore;
  }
  
  try {
    // Try to connect to ChromaDB
    console.log('Attempting to connect to ChromaDB...');
    
    try {
      // First try getting existing collection
      vectorStore = await Chroma.fromExistingCollection(
        embeddings,
        { 
          collectionName: COLLECTION_NAME,
          url: process.env.CHROMA_DB_URL || 'http://localhost:8000',
          timeout: 5000 // 5 second timeout
        }
      );
      
      console.log('ChromaDB vector store initialized successfully');
      usingChromaDB = true;
      
      // If ChromaDB is empty and we have persisted docs, load them
      const count = await vectorStore.collection.count();
      if (count === 0 && persistedDocuments.length > 0) {
        console.log(`Restoring ${persistedDocuments.length} documents to ChromaDB`);
        for (const doc of persistedDocuments) {
          await vectorStore.addDocuments([doc]);
        }
      }
      
      return vectorStore;
    } catch (error) {
      console.warn('Error connecting to existing ChromaDB collection, trying to create new collection');
      
      // Try creating a new collection as fallback
      vectorStore = new Chroma(
        embeddings,
        { 
          collectionName: COLLECTION_NAME,
          url: process.env.CHROMA_DB_URL || 'http://localhost:8000',
          timeout: 5000
        }
      );
      
      console.log('Created new ChromaDB collection');
      usingChromaDB = true;
      return vectorStore;
    }
  } catch (error) {
    console.warn('ChromaDB initialization failed, creating in-memory store:', error.message);
    
    // Fallback to in-memory store
    vectorStore = await createInMemoryStore();
    usingChromaDB = false;
    return vectorStore;
  }
}

/**
 * Get the current vector store
 * @returns {Object} Vector store instance
 */
export function getVectorStore() {
  return vectorStore;
}

/**
 * Get the OpenAI embeddings instance
 * @returns {OpenAIEmbeddings} Embeddings instance
 */
export function getEmbeddings() {
  return embeddings;
}

/**
 * Check if using ChromaDB or fallback store
 * @returns {boolean} True if using ChromaDB, false if using fallback
 */
export function isUsingChromaDB() {
  return usingChromaDB;
}

/**
 * Set vector store to in-memory fallback mode
 * Called when ChromaDB operations fail
 */
export async function setFallbackMode() {
  if (!usingChromaDB) return; // Already in fallback mode
  
  console.log('Setting vector store to fallback mode');
  vectorStore = await createInMemoryStore();
  usingChromaDB = false;
} 