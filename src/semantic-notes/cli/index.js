#!/usr/bin/env node
/**
 * CLI entry point for Semantic Notes
 */
const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const noteService = require('../services/notes');
const config = require('../utils/config');
const logger = require('../utils/logger');

// Initialize the service
(async () => {
  await noteService.init();
})();

// Set up the CLI program
program
  .name('semantic-notes')
  .description('Semantic note-taking with AI-powered search')
  .version('0.1.0');

// Add command
program
  .command('add')
  .description('Add a new note')
  .argument('[text]', 'Note text content')
  .option('-t, --title <title>', 'Note title')
  .option('-u, --url <url>', 'Source URL')
  .option('--tags <tags>', 'Comma-separated tags', val => val.split(',').map(t => t.trim()))
  .action(async (text, options) => {
    try {
      // If no text provided, prompt for it
      if (!text) {
        const answers = await inquirer.prompt([
          {
            type: 'editor',
            name: 'text',
            message: 'Enter your note content:',
            validate: input => (input && input.trim() !== '') ? true : 'Note content cannot be empty'
          }
        ]);
        text = answers.text;
      }
      
      // Collect additional info if not provided
      if (!options.title) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'title',
            message: 'Enter a title for your note (optional):',
          }
        ]);
        options.title = answers.title;
      }
      
      // Create the note
      const result = await noteService.createNote({
        text,
        title: options.title || '',
        url: options.url || '',
        tags: options.tags || []
      });
      
      if (result.success) {
        console.log(chalk.green('\n✓ Note saved successfully'));
        console.log(chalk.cyan(`ID: ${result.note.id}`));
        console.log(chalk.white(`Title: ${result.note.title || '(No title)'}`));
        console.log(chalk.white(`Created: ${new Date(result.note.timestamp).toLocaleString()}`));
        
        // Prompt to generate embedding
        const embedAnswer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'generateEmbedding',
            message: 'Would you like to generate embedding for this note now?',
            default: true
          }
        ]);
        
        if (embedAnswer.generateEmbedding) {
          console.log(chalk.cyan('\nGenerating embedding...'));
          await noteService.generateEmbeddings();
          console.log(chalk.green('✓ Embedding generated successfully'));
        }
      } else {
        console.error(chalk.red(`\n✗ Error: ${result.error}`));
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}`));
    }
  });

// List command
program
  .command('list')
  .description('List all notes')
  .option('-l, --limit <number>', 'Maximum number of notes to display', parseInt)
  .action(async (options) => {
    try {
      const result = await noteService.getAllNotes();
      
      if (result.success) {
        if (result.notes.length === 0) {
          console.log(chalk.yellow('\nNo notes found.'));
        } else {
          console.log(chalk.cyan(`\nFound ${result.notes.length} note(s):\n`));
          
          // Sort by recency (newest first)
          const sortedNotes = [...result.notes].sort((a, b) => b.timestamp - a.timestamp);
          const limit = options.limit || sortedNotes.length;
          
          sortedNotes.slice(0, limit).forEach((note, index) => {
            console.log(chalk.white(`${index + 1}. ${chalk.bold(note.title || '(No title)')}`));
            console.log(chalk.gray(`   ID: ${note.id}`));
            console.log(chalk.gray(`   Created: ${new Date(note.timestamp).toLocaleString()}`));
            if (note.tags && note.tags.length > 0) {
              console.log(chalk.blue(`   Tags: ${note.tags.join(', ')}`));
            }
            console.log(chalk.white(`   ${note.text.substring(0, 100)}${note.text.length > 100 ? '...' : ''}`));
            console.log(chalk.gray(`   Has embedding: ${note.embedding ? 'Yes' : 'No'}`));
            console.log();
          });
          
          if (limit < result.notes.length) {
            console.log(chalk.gray(`Showing ${limit} of ${result.notes.length} notes. Use --limit to show more.`));
          }
        }
      } else {
        console.error(chalk.red(`\n✗ Error: ${result.error}`));
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}`));
    }
  });

// Search command
program
  .command('search')
  .description('Search notes')
  .argument('<query>', 'Search query')
  .option('-t, --type <type>', 'Search type (keyword, semantic, hybrid)', 'hybrid')
  .option('-l, --limit <number>', 'Maximum number of results', parseInt)
  .option('--threshold <number>', 'Minimum similarity threshold (0-1)', parseFloat)
  .option('--scores', 'Show similarity scores', false)
  .action(async (query, options) => {
    try {
      console.log(chalk.cyan(`\nSearching for "${query}" using ${options.type} search...\n`));
      
      const searchOptions = {
        type: options.type,
        limit: options.limit || config.settings.maxResultsPerPage,
        includeScores: options.scores
      };
      
      if (options.threshold) {
        searchOptions.threshold = options.threshold;
      }
      
      const result = await noteService.searchNotes(query, searchOptions);
      
      if (result.success) {
        if (result.notes.length === 0) {
          console.log(chalk.yellow(`No notes found matching "${query}".`));
          
          if (result.needsEmbeddings) {
            console.log(chalk.yellow('\nNotes need embeddings for semantic search. Generate them first:'));
            console.log(chalk.cyan('  $ node src/cli/index.js generate-embeddings'));
          }
        } else {
          console.log(chalk.cyan(`Found ${result.notes.length} note(s) matching "${query}":\n`));
          
          result.notes.forEach((note, index) => {
            console.log(chalk.white(`${index + 1}. ${chalk.bold(note.title || '(No title)')}`));
            console.log(chalk.gray(`   ID: ${note.id}`));
            console.log(chalk.gray(`   Created: ${new Date(note.timestamp).toLocaleString()}`));
            if (note.tags && note.tags.length > 0) {
              console.log(chalk.blue(`   Tags: ${note.tags.join(', ')}`));
            }
            if (options.scores && note.similarity !== undefined) {
              console.log(chalk.green(`   Similarity: ${(note.similarity * 100).toFixed(2)}%`));
            }
            console.log(chalk.white(`   ${note.text.substring(0, 100)}${note.text.length > 100 ? '...' : ''}`));
            console.log();
          });
        }
      } else {
        console.error(chalk.red(`\n✗ Error: ${result.error}`));
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}`));
    }
  });

// Generate embeddings command
program
  .command('generate-embeddings')
  .description('Generate embeddings for all notes without them')
  .action(async () => {
    try {
      console.log(chalk.cyan('\nGenerating embeddings for notes...\n'));
      
      const result = await noteService.generateEmbeddings();
      
      if (result.success) {
        console.log(chalk.green(`✓ Embedding generation complete:`));
        console.log(chalk.white(`  - ${result.processed} notes processed`));
        console.log(chalk.white(`  - ${result.skipped} notes skipped (already had embeddings)`));
        if (result.failed > 0) {
          console.log(chalk.yellow(`  - ${result.failed} notes failed`));
        }
        console.log(chalk.white(`  - ${result.total} total notes`));
      } else {
        console.error(chalk.red(`\n✗ Error: ${result.error}`));
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}`));
    }
  });

// Delete command
program
  .command('delete')
  .description('Delete a note by ID')
  .argument('<id>', 'Note ID')
  .action(async (id) => {
    try {
      // Get the note first to confirm
      const getResult = await noteService.getNoteById(id);
      
      if (!getResult.success) {
        console.error(chalk.red(`\n✗ Error: ${getResult.error}`));
        return;
      }
      
      // Show note details
      const note = getResult.note;
      console.log(chalk.cyan('\nNote to delete:'));
      console.log(chalk.white(`Title: ${chalk.bold(note.title || '(No title)')}`));
      console.log(chalk.white(`Created: ${new Date(note.timestamp).toLocaleString()}`));
      console.log(chalk.white(`Content: ${note.text.substring(0, 100)}${note.text.length > 100 ? '...' : ''}`));
      
      // Confirm deletion
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to delete this note?',
          default: false
        }
      ]);
      
      if (!answers.confirm) {
        console.log(chalk.yellow('\nDeletion cancelled.'));
        return;
      }
      
      // Delete the note
      const result = await noteService.deleteNote(id);
      
      if (result.success) {
        console.log(chalk.green('\n✓ Note deleted successfully'));
      } else {
        console.error(chalk.red(`\n✗ Error: ${result.error}`));
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}`));
    }
  });

// Validate config
const missingConfig = config.validateConfig();
if (missingConfig.length > 0) {
  console.warn(chalk.yellow('\nWarning: Some configuration is missing:'));
  missingConfig.forEach(item => {
    console.warn(chalk.yellow(`- ${item} is not set`));
  });
  console.warn(chalk.yellow('Some functionality may be limited.\n'));
}

// Parse arguments
program.parse();

// If no args provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 