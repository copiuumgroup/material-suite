/**
 * Utility functions for Material Suite
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines tailwind classes with safety and priority merging.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a unique ID using the browser's crypto API.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Formats a time in seconds to MM:SS format.
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Delays execution for a specified duration.
 */
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
