/**
 * Error handling utilities
 */

import { Response } from 'express';

/**
 * Sanitize error message for public consumption
 */
export function sanitizeError(error: any): string {
  if (typeof error === 'string') return error;
  
  const message = error?.message || 'Unknown error';
  
  // List of sensitive keywords to strip
  const sensitiveKeywords = ['stack', 'path', 'file', '/', '\\', 'api_key', 'key', 'token', 'secret'];
  
  if (sensitiveKeywords.some(k => message.toLowerCase().includes(k))) {
    return 'An internal error occurred. Please try again later.';
  }
  
  return message;
}

/**
 * Send a sanitized error response
 */
export function sendError(res: Response, status: number, message: string, error?: any) {
  if (error) {
    console.error(`[API Error] ${status} ${message}:`, error.message || error);
    if (error.stack) console.error(error.stack);
  }
  
  res.status(status).json({ 
    error: status >= 500 ? 'Internal server error' : sanitizeError(message || error)
  });
}
