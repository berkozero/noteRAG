/**
 * LlamaIndex Vector Store Integration
 * 
 * This module provides a LlamaIndex-based vector store implementation
 * for advanced RAG capabilities with hybrid search.
 */

import {
  VectorStoreIndex,
  Document,
  serviceContextFromDefaults,
  OpenAIEmbedding,
  storageContextFromDefaults,
  SimpleNodeParser,
  SummaryIndex,
  QueryEngineTool,
  MetadataInfo,
  MetadataMode,
} from 'llamaindex';

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// Determine file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Define paths and constants
const DATA_DIR = path.resolve(__dirname, '../../../data');
const INDEX_FILE = path.resolve(DATA_DIR, 'llamaindex-store.json');

// Global state
let vectorIndex = null;
let serviceContext = null;
let storageContext = null;
let nodeParser = null;

/**
 * Initialize LlamaIndex with OpenAI embeddings
 */
export async function initLlamaIndex() {
  try {
    console.log('Initializing LlamaIndex with OpenAI embeddings...');

    // Create data directory if it doesn't exist
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Initialize LlamaIndex components
    serviceContext = serviceContextFromDefaults({
      llm: undefined, // No LLM needed for just embeddings
      embedModel: new OpenAIEmbedding({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      }),
    });

    // Create storage context (for persistence)
    storageContext = await storageContextFromDefaults({
      persistDir: DATA_DIR,
    });

    // Node parser configuration
    nodeParser = new SimpleNodeParser({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Check if we have a saved index
    try {
      const stats = await fs.stat(INDEX_FILE);
      if (stats.isFile()) {
        console.log('Loading existing LlamaIndex from disk...');
        // Load existing index (implement when needed)
        // This might require additional steps with LlamaIndex JS
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error checking for index file:', error);
      }
    }

    // If no existing index was loaded, create a new one
    if (!vectorIndex) {
      console.log('Creating new LlamaIndex...');
      vectorIndex = await VectorStoreIndex.init({
        serviceContext,
        storageContext,
      });
    }

    console.log('LlamaIndex initialization complete');
    return vectorIndex;
  } catch (error) {
    console.error('Error initializing LlamaIndex:', error);
    throw error;
  }
}

/**
 * Add a document to the LlamaIndex vector store
 * @param {string} text Document text
 * @param {Object} metadata Document metadata
 * @returns {Promise<Object>} Result of the operation
 */
export async function addDocumentToLlamaIndex(text, metadata) {
  if (!vectorIndex) {
    throw new Error('LlamaIndex not initialized');
  }

  try {
    console.log(`Adding document with id ${metadata.id} to LlamaIndex...`);

    // Convert the text and metadata into a LlamaIndex Document
    const llamaDoc = new Document({
      text,
      metadata: {
        ...metadata,
        source: metadata.url || 'user-input',
      },
      id: metadata.id,
    });

    // Parse the document into nodes
    const nodes = nodeParser.getNodesFromDocuments([llamaDoc]);

    // Add to the index
    await vectorIndex.insert(nodes);

    // Save to disk
    await saveToDisk();

    console.log(`Document added to LlamaIndex with id: ${metadata.id}`);
    return { success: true, id: metadata.id };
  } catch (error) {
    console.error('Error adding document to LlamaIndex:', error);
    throw error;
  }
}

/**
 * Save the index to disk
 */
async function saveToDisk() {
  try {
    // LlamaIndex JS may have different persistence methods
    // For now, we're using the built-in persistence from storageContext
    await vectorIndex.storage.persist();
    console.log('Index saved to disk');
    return true;
  } catch (error) {
    console.error('Error saving index to disk:', error);
    return false;
  }
}

/**
 * Perform hybrid search with LlamaIndex
 * @param {string} query Search query
 * @param {number} limit Maximum number of results
 * @param {number} threshold Minimum similarity threshold
 * @returns {Promise<Array>} Search results
 */
export async function searchWithLlamaIndex(query, limit = 5, threshold = 0.2) {
  if (!vectorIndex) {
    throw new Error('LlamaIndex not initialized');
  }

  try {
    console.log(`Performing LlamaIndex search for: "${query}"`);

    // Create retriever with hybrid search
    const retriever = vectorIndex.asRetriever({
      similarityTopK: limit * 2, // Get more results initially
      mode: 'hybrid',            // Use hybrid search (semantic + keyword)
      alphaWeight: 0.5,          // Balance between vector and keyword
    });

    // Retrieve nodes
    const retrievedNodes = await retriever.retrieve(query);

    console.log(`LlamaIndex retrieved ${retrievedNodes.length} initial results`);

    // Convert retrieved nodes to standardized format and filter by threshold
    const results = retrievedNodes
      .filter(node => node.score >= threshold)
      .map(node => ({
        id: node.id || node.nodeId,
        score: node.score,
        metadata: node.metadata,
        content: node.text,
        matchDetails: {
          // LlamaIndex doesn't directly expose these details, so we estimate
          vectorScore: node.score,
          keywordScore: 0, // LlamaIndex doesn't expose this separately
          matchedKeywords: []
        }
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`LlamaIndex returning ${results.length} filtered results`);
    return results;
  } catch (error) {
    console.error('Error during LlamaIndex search:', error);
    throw error;
  }
}

/**
 * Get all documents from LlamaIndex
 * @returns {Promise<Array>} Array of documents
 */
export async function getAllDocumentsFromLlamaIndex() {
  if (!vectorIndex) {
    throw new Error('LlamaIndex not initialized');
  }

  try {
    // LlamaIndex JS might not have a direct way to list all documents
    // This is a simplified approach that could be improved
    const emptyQuery = '';
    const allResults = await searchWithLlamaIndex(emptyQuery, 1000, 0);
    return allResults;
  } catch (error) {
    console.error('Error getting all documents from LlamaIndex:', error);
    throw error;
  }
}

/**
 * Delete a document from LlamaIndex
 * @param {string} documentId ID of the document to delete
 * @returns {Promise<Object>} Result of the operation
 */
export async function deleteDocumentFromLlamaIndex(documentId) {
  if (!vectorIndex) {
    throw new Error('LlamaIndex not initialized');
  }

  try {
    console.log(`Deleting document with id ${documentId} from LlamaIndex...`);
    
    // Delete the node
    await vectorIndex.deleteNode(documentId);
    
    // Save to disk
    await saveToDisk();
    
    console.log(`Document deleted from LlamaIndex with id: ${documentId}`);
    return { success: true, id: documentId };
  } catch (error) {
    console.error('Error deleting document from LlamaIndex:', error);
    throw error;
  }
} 