/**
 * Note Storage Test Module
 * 
 * This file contains test functions to verify the functionality of the note storage system.
 */

import fs from './fs-browser';
import { semanticBridge } from './semantic-bridge';

// Test saving a note
const testSaveNote = async () => {
  const testNote = {
    id: 'test-note-' + Date.now(),
    title: 'Test Note Title',
    text: 'This is a test note content with some searchable keywords like apple, banana, and orange.',
    url: 'https://example.com/test',
    timestamp: Date.now()
  };
  
  try {
    const savedNote = await semanticBridge.saveNote(testNote);
    console.log('Test note saved successfully');
    return savedNote;
  } catch (error) {
    console.error('Failed to save test note:', error);
    return null;
  }
};

// Test getting all notes
const testGetAllNotes = async () => {
  try {
    const notes = await semanticBridge.getAllNotes();
    console.log(`Retrieved ${notes.length} notes`);
    return notes;
  } catch (error) {
    console.error('Failed to get all notes:', error);
    return [];
  }
};

// Test searching notes
const testSearchNotes = async (query) => {
  try {
    const results = await semanticBridge.searchNotes(query);
    console.log(`Search for "${query}" found ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Failed to search notes:', error);
    return [];
  }
};

// Run all tests
const runAllTests = async () => {
  console.log('===== Starting Note Storage Tests =====');
  
  // Save a test note
  const savedNote = await testSaveNote();
  
  // Get all notes
  await testGetAllNotes();
  
  // Search for the test note
  if (savedNote) {
    // Search for words in the note
    await testSearchNotes('test');
    await testSearchNotes('apple');
    
    // Search for a word not in the note
    await testSearchNotes('nonexistent');
  }
  
  console.log('===== Note Storage Tests Completed =====');
};

// Reset the filesystem (clear all test data)
const resetFilesystem = async () => {
  console.log('Resetting filesystem...');
  
  // Get all files
  const files = await fs.getAllFiles();
  
  // Count how many files we'll delete
  let count = 0;
  
  // Loop through all files and remove them
  for (const filePath in files) {
    try {
      // If it's a directory, use rmdirSync
      if (files[filePath].isDirectory) {
        // Skip root directories
        if (filePath.split('/').length > 2) {
          await fs.rmdirSync(filePath);
          count++;
        }
      } else {
        await fs.unlinkSync(filePath);
        count++;
      }
    } catch (error) {
      console.error(`Failed to delete ${filePath}:`, error);
    }
  }
  
  // Re-initialize directories
  await fs.ensureDirSync('/data');
  await fs.ensureDirSync('/data/notes');
  await fs.ensureDirSync('/data/embeddings');
  
  console.log(`Filesystem reset completed. Deleted ${count} files/directories`);
};

// Simplified function to create a test note quickly
const createTestNote = async () => {
  const timestamp = Date.now();
  const noteId = `test-note-${timestamp}`;
  
  // Generate different content for each test note
  const testTitles = [
    'Research on Machine Learning',
    'Web Development Best Practices',
    'Productivity Tips',
    'Book Notes: Sapiens',
    'Project Ideas',
    'Meeting Notes'
  ];
  
  const testContents = [
    'Machine learning focuses on developing algorithms that can learn from data and make predictions. Key concepts include supervised learning, unsupervised learning, and reinforcement learning.',
    'Modern web development includes responsive design, accessibility, performance optimization, and progressive enhancement.',
    'To improve productivity: use time-blocking, minimize distractions, take regular breaks, and prioritize tasks based on importance.',
    'Sapiens by Yuval Noah Harari explores the history of human evolution and how Homo sapiens came to dominate the world.',
    'Project idea: build a tool that automatically organizes notes by topic using machine learning and semantic search.',
    'Discussed project timeline, assigned tasks to team members, and scheduled follow-up meeting for next week.'
  ];
  
  // Pick a random combination or use timestamp to determine which content to use
  const index = timestamp % testTitles.length;
  
  const testNote = {
    id: noteId,
    title: testTitles[index],
    text: testContents[index],
    url: `https://example.com/test-${index}`,
    timestamp: timestamp
  };
  
  try {
    const savedNote = await semanticBridge.saveNote(testNote);
    console.log(`Test note created with ID: ${noteId} and title: ${testTitles[index]}`);
    
    return savedNote;
  } catch (error) {
    console.error('Failed to create test note:', error);
    return null;
  }
};

// Export the test functions
export const noteTests = {
  runAllTests,
  testSaveNote,
  testGetAllNotes,
  testSearchNotes,
  resetFilesystem,
  createTestNote
};

// Make tests available globally for browser console testing
if (typeof window !== 'undefined') {
  window.noteTests = noteTests;
} 