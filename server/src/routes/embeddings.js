import express from 'express';
import { addDocument, deleteDocument, getVectorStore } from '../utils/langchain-store.js';

const router = express.Router();

// Simple request log to prevent duplicate requests
const recentRequests = new Map();
const REQUEST_TIMEOUT = 5000; // 5 seconds

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
    
    // Check for duplicate request
    const requestKey = `embed-${note.id}`;
    const lastRequest = recentRequests.get(requestKey);
    const now = Date.now();
    
    if (lastRequest && (now - lastRequest) < REQUEST_TIMEOUT) {
      console.log(`Duplicate request detected for note ${note.id}, skipping`);
      return res.json({
        success: true,
        noteId: note.id,
        message: 'Duplicate request skipped - note was recently processed'
      });
    }
    
    // Mark this request
    recentRequests.set(requestKey, now);
    
    // Clean up old requests periodically
    if (recentRequests.size > 100) {
      const cutoff = now - REQUEST_TIMEOUT;
      for (const [key, timestamp] of recentRequests.entries()) {
        if (timestamp < cutoff) {
          recentRequests.delete(key);
        }
      }
    }
    
    // Generate embeddings using LangChain
    console.log(`Generating embeddings for note: ${note.id}`);
    
    // Create content for embedding
    const content = `${note.title || ''} ${note.text}`.trim();
    
    // Create metadata
    const metadata = {
      id: note.id,
      title: note.title || '',
      url: note.url || '',
      timestamp: note.timestamp || Date.now(),
      type: 'note'
    };
    
    // Store in LangChain vector store
    const result = await addDocument(content, metadata);
    
    res.json({
      success: true,
      noteId: note.id,
      message: 'Embeddings created and stored with LangChain'
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
    
    console.log(`Deleting embeddings for note: ${noteId}`);
    
    // Delete from LangChain vector store
    await deleteDocument(noteId);
    
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