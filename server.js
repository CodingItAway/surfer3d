import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Serve the compiled game files from Vite's 'dist' folder
app.use(express.static(path.join(__dirname, 'dist')));

// The Health API Endpoint (Keeps Render active)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'active', message: 'Server is running' });
});

// Fallback to index.html for single page apps (helps Vite routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Game server running on port ${port}`);
});