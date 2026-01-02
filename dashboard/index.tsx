import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Helper function to check if error is a Firestore internal error
const isFirestoreInternalError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = typeof error === 'string' ? error : error?.message || '';
  const errorCode = error?.code;
  
  return (
    errorMessage.includes('INTERNAL ASSERTION FAILED') ||
    errorMessage.includes('Unexpected state') ||
    errorCode === 'ca9' ||
    errorCode === 'c050' ||
    errorCode === 'b815' ||
    errorMessage.includes('ID: ca9') ||
    errorMessage.includes('ID: c050') ||
    errorMessage.includes('ID: b815')
  );
};

// Intercept console.error and console.warn to suppress Firestore errors
const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);

console.error = (...args: any[]) => {
  const errorString = args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg?.message) return arg.message;
    if (arg?.toString) return arg.toString();
    return String(arg);
  }).join(' ');
  
  if (isFirestoreInternalError(errorString) || args.some(arg => isFirestoreInternalError(arg))) {
    // Suppress Firestore internal errors from console completely
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  const errorString = args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg?.message) return arg.message;
    if (arg?.toString) return arg.toString();
    return String(arg);
  }).join(' ');
  
  if (isFirestoreInternalError(errorString) || args.some(arg => isFirestoreInternalError(arg))) {
    // Suppress Firestore internal errors from console completely
    return;
  }
  originalConsoleWarn(...args);
};

// Setup global error handlers for Firestore internal errors
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  if (isFirestoreInternalError(event.reason)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return false;
  }
}, true);

window.addEventListener('error', (event: ErrorEvent) => {
  if (isFirestoreInternalError(event.error) || isFirestoreInternalError(event.message)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return false;
  }
}, true);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);