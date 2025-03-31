import express from 'express';
import { getCollection, COLLECTION_NAME } from '../index.js';
import { generateEmbedding } from '../utils/embeddings.js';

const router = express.Router();

/**
 * Create embeddings for a note
 * POST /api/embeddings
 */
router.post('/', async (req, res) => {
  try {
    const { note } = req.body;
    
    if (!note || !note.id || !note.text) {
      return res.status(400).json({ 
        error: 'Missing required fields: note, note.id, or note.text' 
      });
    }
    
    // Generate embeddings
    console.log(`Generating embeddings for note: ${note.id}`);
    const collection = getCollection();
    
    if (!collection) {
      console.warn('ChromaDB collection not available, returning mock embeddings');
      return res.json({
        success: true,
        noteId: note.id,
        embedding: 'mock-embedding-fallback',
        message: 'ChromaDB not available, using fallback'
      });
    }
    
    // Create content for embedding
    const content = `${note.title || ''} ${note.text}`.trim();
    const embedding = await generateEmbedding(content);
    
    // Store in ChromaDB
    await collection.add({
      ids: [note.id],
      embeddings: [embedding],
      metadatas: [{
        title: note.title || '',
        url: note.url || '',
        timestamp: note.timestamp || Date.now(),
        type: 'note'
      }],
      documents: [content]
    });
    
    res.json({
      success: true,
      noteId: note.id,
      message: 'Embeddings created and stored'
    });
  } catch (error) {
    console.error('Error creating embeddings:', error);
    res.status(500).json({ 
      error: 'Failed to create embeddings',
      message: error.message 
    });
  }
});

/**
 * Delete embeddings for a note
 * DELETE /api/embeddings/:noteId
 */
router.delete('/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;
    const collection = getCollection();
    
    if (!collection) {
      return res.json({
        success: true,
        noteId,
        message: 'ChromaDB not available, no action needed'
      });
    }
    
    await collection.delete({
      ids: [noteId]
    });
    
    res.json({
      success: true,
      noteId,
      message: 'Embeddings deleted'
    });
  } catch (error) {
    console.error('Error deleting embeddings:', error);
    res.status(500).json({ 
      error: 'Failed to delete embeddings',
      message: error.message 
    });
  }
});

export default router; 