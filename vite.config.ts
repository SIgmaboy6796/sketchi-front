import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'world-data-api',
      configureServer(server) {
        return () => {
          server.middlewares.use(express.json({ limit: '50mb' }))
          server.middlewares.post('/api/save-world', (req, res) => {
            try {
              const publicDir = path.join(__dirname, 'public')
              if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true })
              }
              const filePath = path.join(publicDir, 'world-data.json')
              fs.writeFileSync(filePath, JSON.stringify(req.body), 'utf-8')
              console.log(`✓ World data saved to public/world-data.json (${JSON.stringify(req.body).length} bytes)`)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, message: 'World data saved' }))
            } catch (error) {
              console.error('Error saving world data:', error)
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: error.message }))
            }
          })
        }
      }
    }
  ],
  publicDir: 'public',
})