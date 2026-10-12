// Set before importing the server so npm start never mounts Vite middleware.
process.env.NODE_ENV = 'production';
await import('../dist/server.cjs');
