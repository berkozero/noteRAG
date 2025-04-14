import { cn } from './utils';

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const isHovered = false;
    expect(cn('base', isActive && 'active', isHovered && 'hovered')).toBe('base active');
  });

  it('should override conflicting Tailwind classes (tailwind-merge)', () => {
    // twMerge should handle merging padding classes, keeping the last one
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('px-4', 'p-2')).toBe('p-2'); // p-2 overrides px-4
    expect(cn('p-2', 'px-4')).toBe('p-2 px-4'); // px-4 specifies x-axis after p-2 specifies all
  });

  it('should handle arrays and objects', () => {
    expect(cn(['block', 'font-bold'], { 'text-center': true })).toBe('block font-bold text-center');
  });

  it('should handle falsy values', () => {
    expect(cn('base', null, undefined, false, '', 'extra')).toBe('base extra');
  });
}); 