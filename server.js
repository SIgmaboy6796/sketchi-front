import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.static('dist'));
app.use(express.json({ limit: '50mb' }));

// API endpoint to save world data
app.post('/api/save-world', (req, res) => {
    try {
        const data = req.body;
        const publicDir = path.join(__dirname, 'public');
        
        // Create public directory if it doesn't exist
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        
        const filePath = path.join(publicDir, 'world-data.json');
        fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
        
        console.log(`✓ World data saved to ${filePath} (${JSON.stringify(data).length} bytes)`);
        res.json({ success: true, message: 'World data saved successfully', path: filePath });
    } catch (error) {
        console.error('Error saving world data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve cached world data if available
app.get('/world-data.json', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'public', 'world-data.json');
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).json({ error: 'World data not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5173;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`World generation cache will be saved to ./public/world-data.json`);
});
