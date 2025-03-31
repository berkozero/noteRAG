/**
 * Embeddings utility
 * 
 * This module provides text embedding functionality with two implementations:
 * 1. OpenAI embeddings API (when API key is configured)
 * 2. Simple fallback implementation for development/testing
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env
const result = dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
if (result.error) {
  console.warn('Error loading .env file in embeddings.js:', result.error);
}

// Debug information about environment variables
console.log('DEBUG ENV VARS (embeddings.js):');
console.log(`USE_OPENAI value: "${process.env.USE_OPENAI}"`);
console.log(`OPENAI_API_KEY exists: ${Boolean(process.env.OPENAI_API_KEY)}`);
console.log(`OPENAI_API_KEY length: ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0}`);
console.log(`OPENAI_EMBEDDING_MODEL: "${process.env.OPENAI_EMBEDDING_MODEL}"`);

// OpenAI configuration
const useOpenAI = process.env.USE_OPENAI === 'true' && Boolean(process.env.OPENAI_API_KEY);
console.log(`useOpenAI evaluation result: ${useOpenAI}`);
const openaiApiKey = process.env.OPENAI_API_KEY;
const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

// Initialize OpenAI client if configured
let openai;
if (useOpenAI) {
  try {
    openai = new OpenAI({
      apiKey: openaiApiKey
    });
    console.log(`OpenAI client initialized with model: ${embeddingModel}`);
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error);
    console.log('Falling back to simple embeddings');
  }
}

// Dimensions for embeddings
const EMBEDDING_DIM = 1536; // Default dimension for text-embedding-3-small
console.log(`Using embedding dimension: ${EMBEDDING_DIM}`);

/**
 * Generate embeddings for text using OpenAI API or fallback to simple implementation
 * 
 * @param {string} text - The text to embed
 * @returns {number[]} - The embedding vector
 */
export async function generateEmbedding(text) {
  // Check if text is valid
  if (!text || typeof text !== 'string' || text.trim() === '') {
    console.warn('Empty or invalid text provided for embedding');
    return new Array(EMBEDDING_DIM).fill(0);
  }
  
  const cleanText = text.trim();
  
  // Try OpenAI if configured
  if (openai) {
    try {
      console.log('Using OpenAI for embeddings generation');
      
      const response = await openai.embeddings.create({
        model: embeddingModel,
        input: cleanText
        // Using default dimension (1536) for text-embedding-3-small
      });
      
      const embedding = response.data[0].embedding;
      console.log(`Generated OpenAI embedding with ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      console.error('OpenAI embedding generation failed:', error);
      console.log('Falling back to simple embedding implementation');
    }
  }
  
  // Fallback to simple implementation
  console.log('Using simple fallback for embeddings generation');
  return generateSimpleEmbedding(cleanText);
}

/**
 * Generate a simple embedding vector for text
 * This is a basic implementation used as fallback when OpenAI is not available
 * 
 * @param {string} text - The text to embed
 * @returns {number[]} - The embedding vector
 */
function generateSimpleEmbedding(text) {
  // Simple hash-based approach for demo purposes
  const embedding = new Array(EMBEDDING_DIM).fill(0);
  
  // Generate a simple embedding based on character values
  const normalizedText = text.toLowerCase().trim();
  for (let i = 0; i < normalizedText.length; i++) {
    const charCode = normalizedText.charCodeAt(i);
    const position = i % EMBEDDING_DIM;
    
    // Add character influence to the embedding
    embedding[position] += charCode / 1000;
    
    // Add some position-based variance
    const nextPos = (position + 1) % EMBEDDING_DIM;
    embedding[nextPos] += (charCode % 7) / 100;
    
    // And some word-based patterns (using spaces as word boundaries)
    if (normalizedText[i] === ' ' || i === normalizedText.length - 1) {
      const wordLength = normalizedText[i] === ' ' ? 
        (i - normalizedText.lastIndexOf(' ', i - 1)) : 
        (i - normalizedText.lastIndexOf(' '));
      
      const wordPosStart = (position + 10) % EMBEDDING_DIM;
      for (let j = 0; j < 5; j++) {
        embedding[(wordPosStart + j) % EMBEDDING_DIM] += wordLength / 50;
      }
    }
  }
  
  // Normalize the embedding values
  let magnitude = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    magnitude += embedding[i] * embedding[i];
  }
  magnitude = Math.sqrt(magnitude);
  
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    embedding[i] = embedding[i] / magnitude;
  }
  
  return embedding;
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Similarity score (0-1)
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  
  if (magA === 0 || magB === 0) {
    return 0;
  }
  
  return dotProduct / (magA * magB);
} 