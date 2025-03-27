#!/usr/bin/env node

/**
 * Command Line Interface for Semantic Notes
 * Provides commands for adding, listing, searching, and managing notes
 */
const fs = require('fs-extra');
const path = require('path');
const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const notes = require('./services/notes');
const logger = require('./utils/logger');
const formatters = require('./utils/formatters');

// Initialize the program
const program = new Command();

// Set program metadata
program
  .name('semantic-notes')
  .description('A CLI tool for managing notes with semantic search')
  .version('1.0.0');

/**
 * Initialize services
 */
async function initializeServices() {
  try {
    // Initialize the notes service
    const initialized = await notes.init();
    
    if (!initialized) {
      console.error(chalk.red('Failed to initialize services. Please check logs for details.'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`Initialization error: ${error.message}`));
    logger.error('CLI initialization error', error);
    process.exit(1);
  }
}

/**
 * Format a note for display
 */
function formatNote(note, { includeContent = false } = {}) {
  const title = note.title || 'Untitled';
  const url = note.url ? `\n${chalk.blue('URL:')} ${note.url}` : '';
  const date = formatters.formatDate(note.created || note.updated);
  
  let output = `
${chalk.yellow('ID:')} ${note.id}
${chalk.green('Title:')} ${title}
${chalk.cyan('Date:')} ${date}${url}`;
  
  if (includeContent && note.content) {
    const content = note.content.length > 500 
      ? note.content.substring(0, 500) + '...' 
      : note.content;
    
    output += `\n\n${content}`;
  }
  
  return output;
}

/**
 * Add a new note
 */
program
  .command('add')
  .description('Add a new note')
  .option('-f, --file <path>', 'Path to a file to use as content')
  .option('-t, --title <title>', 'Title for the note')
  .option('-u, --url <url>', 'URL associated with the note')
  .option('--html', 'Treat content as HTML')
  .action(async (options) => {
    await initializeServices();
    
    try {
      let content = '';
      
      // Check if input is being piped in
      if (!process.stdin.isTTY) {
        const chunks = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        content = Buffer.concat(chunks).toString().trim();
      }
      
      // If content wasn't piped and no file is specified, prompt for it
      if (!content && !options.file) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'title',
            message: 'Enter note title:',
            default: options.title || 'Untitled'
          },
          {
            type: 'input',
            name: 'url',
            message: 'Enter URL (optional):',
            default: options.url || ''
          },
          {
            type: 'editor',
            name: 'content',
            message: 'Enter note content:',
          }
        ]);
        
        content = answers.content;
        options.title = answers.title;
        options.url = answers.url;
      } else if (options.file) {
        // Read content from file
        const filePath = path.resolve(process.cwd(), options.file);
        content = await fs.readFile(filePath, 'utf8');
        
        // Use filename as title if not provided
        if (!options.title) {
          options.title = path.basename(filePath, path.extname(filePath));
        }
      }
      
      // Validate content
      if (!content || content.trim() === '') {
        console.error(chalk.red('Note content cannot be empty.'));
        process.exit(1);
      }
      
      // Create the note
      const newNote = await notes.createNote({
        title: options.title,
        content: content.trim(),
        url: options.url,
        isHtml: options.html || false
      });
      
      console.log(chalk.green('\nNote created successfully:'));
      console.log(formatNote(newNote, { includeContent: true }));
    } catch (error) {
      console.error(chalk.red(`Error creating note: ${error.message}`));
      logger.error('Error in add command', error);
      process.exit(1);
    }
  });

/**
 * List all notes
 */
program
  .command('list')
  .description('List all notes')
  .action(async () => {
    await initializeServices();
    
    try {
      const allNotes = await notes.getAllNotes();
      
      if (allNotes.length === 0) {
        console.log(chalk.yellow('No notes found.'));
        return;
      }
      
      console.log(chalk.green(`Found ${allNotes.length} notes:\n`));
      
      // Sort by date (newest first)
      allNotes.sort((a, b) => {
        const dateA = new Date(a.updated || a.created);
        const dateB = new Date(b.updated || b.created);
        return dateB - dateA;
      });
      
      // Display notes
      allNotes.forEach((note, index) => {
        if (index > 0) console.log('──────────────────────────────────────');
        console.log(formatNote(note));
      });
    } catch (error) {
      console.error(chalk.red(`Error listing notes: ${error.message}`));
      logger.error('Error in list command', error);
      process.exit(1);
    }
  });

/**
 * Get a note by ID
 */
program
  .command('get <id>')
  .description('Get a note by ID')
  .action(async (id) => {
    await initializeServices();
    
    try {
      const note = await notes.getNote(id);
      
      if (!note) {
        console.log(chalk.yellow(`No note found with ID: ${id}`));
        return;
      }
      
      console.log(formatNote(note, { includeContent: true }));
    } catch (error) {
      console.error(chalk.red(`Error getting note: ${error.message}`));
      logger.error('Error in get command', error);
      process.exit(1);
    }
  });

/**
 * Delete a note
 */
program
  .command('delete <id>')
  .description('Delete a note by ID')
  .action(async (id) => {
    await initializeServices();
    
    try {
      const success = await notes.deleteNote(id);
      
      if (success) {
        console.log(chalk.green(`Note with ID ${id} deleted successfully.`));
      } else {
        console.log(chalk.yellow(`No note found with ID: ${id}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error deleting note: ${error.message}`));
      logger.error('Error in delete command', error);
      process.exit(1);
    }
  });

/**
 * Search notes
 */
program
  .command('search [query]')
  .description('Search notes')
  .option('-k, --keyword', 'Use keyword search (fallback when semantic search fails)')
  .option('-l, --limit <number>', 'Limit the number of results')
  .option('--score', 'Show match scores')
  .action(async (query, options) => {
    await initializeServices();
    
    try {
      // If no query is provided, prompt for it
      if (!query) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'query',
            message: 'Enter search query:',
          }
        ]);
        
        query = answers.query;
      }
      
      // We now always use semantic search by default
      console.log(chalk.blue(`Searching notes using semantic search for: "${query}"`));
      
      // Perform search
      const results = await notes.searchNotes(query, {
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
        includeScores: options.score
      });
      
      if (results.length === 0) {
        console.log(chalk.yellow('No matching notes found.'));
        return;
      }
      
      console.log(chalk.green(`Found ${results.length} matching notes:\n`));
      
      // Display results
      results.forEach((note, index) => {
        if (index > 0) console.log('──────────────────────────────────────');
        
        let noteOutput = formatNote(note);
        
        // Add score if available
        if (options.score && note.score !== undefined) {
          noteOutput += `\n${chalk.magenta('Score:')} ${note.score.toFixed(4)}`;
        }
        
        console.log(noteOutput);
      });
    } catch (error) {
      console.error(chalk.red(`Error searching notes: ${error.message}`));
      logger.error('Error in search command', error);
      process.exit(1);
    }
  });

// Parse the command line arguments
program.parse(process.argv); 