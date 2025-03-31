/**
 * Document Operations Module
 * 
 * Handles adding, retrieving, and managing documents in the vector store.
 */

import { getVectorStore, isUsingChromaDB, persistData, setFallbackMode } from './store-init.js';

/**
 * Add a document to the vector store
 * @param {string} text Document text
 * @param {Object} metadata Document metadata
 * @returns {Promise<Object>} Result of the operation
 */
export async function addDocument(text, metadata) {
  const vectorStore = getVectorStore();
  
  if (!vectorStore) {
    throw new Error('Vector store not initialized');
  }
  
  console.log(`Adding document with id ${metadata.id} to vector store`);
  
  try {
    // Create document with metadata
    const document = {
      pageContent: text,
      metadata: metadata
    };
    
    // Add the document to the vector store
    await vectorStore.addDocuments([document]);
    
    // If using in-memory store, persist the changes
    if (!isUsingChromaDB()) {
      // Get all documents for persistence
      const allDocs = await getAllDocuments();
      await persistData(allDocs);
    }
    
    console.log(`Document added with id: ${metadata.id}`);
    return { success: true, id: metadata.id };
  } catch (error) {
    console.error('Error adding document to vector store:', error);
    
    // If error is due to ChromaDB connection, try to use in-memory store
    if (error.message && error.message.includes('ChromaConnectionError')) {
      console.log('ChromaDB connection error detected, falling back to in-memory storage');
      await setFallbackMode();
      
      // Try again with in-memory store
      return addDocument(text, metadata);
    }
    
    throw error;
  }
}

/**
 * Get all documents from the vector store
 * @param {number} limit Maximum number of documents to retrieve
 * @returns {Promise<Array>} Array of documents
 */
export async function getAllDocuments(limit = 1000) {
  const vectorStore = getVectorStore();
  
  if (!vectorStore) {
    throw new Error('Vector store not initialized');
  }
  
  try {
    // Use an empty query to get all documents
    const results = await vectorStore.similaritySearchWithScore("", limit);
    return results.map(([doc]) => doc);
  } catch (error) {
    console.error('Error retrieving all documents:', error);
    
    // If error is due to ChromaDB connection, try to use in-memory store
    if (error.message && error.message.includes('ChromaConnectionError')) {
      console.log('ChromaDB connection error detected, falling back to in-memory storage');
      await setFallbackMode();
      
      // Try again with in-memory store
      return getAllDocuments(limit);
    }
    
    throw error;
  }
}

/**
 * Delete a document from the vector store
 * @param {string} documentId ID of the document to delete
 * @returns {Promise<Object>} Result of the operation
 */
export async function deleteDocument(documentId) {
  const vectorStore = getVectorStore();
  
  if (!vectorStore) {
    throw new Error('Vector store not initialized');
  }
  
  console.log(`Deleting document with id ${documentId} from vector store`);
  
  try {
    // Different deletion methods based on store type
    if (isUsingChromaDB()) {
      await vectorStore.delete({ ids: [documentId] });
    } else {
      // For in-memory store, get all docs, filter, and re-add
      const allDocs = await getAllDocuments();
      const filteredDocs = allDocs.filter(doc => doc.metadata.id !== documentId);
      
      // Create a new in-memory store and add the filtered documents
      const newStore = await vectorStore.fromDocuments(filteredDocs, vectorStore.embeddings);
      vectorStore = newStore;
      
      // Persist the changes
      await persistData(filteredDocs);
    }
    
    console.log(`Document deleted with id: ${documentId}`);
    return { success: true, id: documentId };
  } catch (error) {
    console.error('Error deleting document from vector store:', error);
    
    // If error is due to ChromaDB connection, try to use in-memory store
    if (error.message && error.message.includes('ChromaConnectionError')) {
      console.log('ChromaDB connection error detected, falling back to in-memory storage');
      await setFallbackMode();
      
      // Try again with in-memory store
      return deleteDocument(documentId);
    }
    
    throw error;
  }
} 