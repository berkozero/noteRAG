import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom'; // For extended matchers like toBeInTheDocument

import { NoteCard } from './note-card';
import type { Note } from '@/types/note';

describe('NoteCard Component', () => {
  const mockNote: Note = {
    id: 'note-123',
    title: 'Test Note Title',
    text: 'This is the test note content.\nIt has multiple lines.',
    created_at: '2023-10-27T10:00:00Z',
    updated_at: '2023-10-28T11:30:00Z',
  };

  const mockNoteUntitled: Note = {
      id: 'note-456',
      title: null,
      text: 'Content for untitled note.',
      created_at: '2023-10-27T10:00:00Z',
      updated_at: '2023-10-29T12:00:00Z',
  };

  it('should render note title and content', () => {
    render(<NoteCard note={mockNote} />);
    expect(screen.getByText('Test Note Title')).toBeInTheDocument();
    // Check for partial content due to line-clamp
    expect(screen.getByText(/This is the test note content/)).toBeInTheDocument();
  });

  it('should render fallback title if title is null', () => {
      render(<NoteCard note={mockNoteUntitled} />);
      expect(screen.getByText('Untitled Note')).toBeInTheDocument();
      expect(screen.getByText('Content for untitled note.')).toBeInTheDocument();
  });

  it('should display the formatted updated date', () => {
    render(<NoteCard note={mockNote} />);
    // Check for the formatted date string (adjust format based on implementation)
    expect(screen.getByText(/Updated Oct 28, 2023/)).toBeInTheDocument(); 
  });

  it('should render action buttons if showActions is true (default)', () => {
    const handleDelete = jest.fn();
    render(<NoteCard note={mockNote} onDelete={handleDelete} />); 
    // Edit button is commented out, so only check delete
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('should NOT render action buttons if showActions is false', () => {
    render(<NoteCard note={mockNote} showActions={false} />);
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  // TODO: Add test for clicking delete button once testing library setup allows user events
  // it('should call onDelete when delete button is clicked', () => {
  //   const handleDelete = jest.fn();
  //   render(<NoteCard note={mockNote} onDelete={handleDelete} />);
  //   const deleteButton = screen.getByRole('button', { name: /delete/i });
  //   // Requires userEvent setup from testing-library
  //   // await userEvent.click(deleteButton);
  //   // expect(handleDelete).toHaveBeenCalledTimes(1);
  // });
}); 