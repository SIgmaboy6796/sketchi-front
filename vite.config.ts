import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/

// Simple world data saver plugin for development
function worldDataPlugin(): Plugin {
  return {
    name: 'world-data-saver',
    apply: 'serve',
    configureServer(server) {
      return () => {
        server.middlewares.use((req: any, res: any, next: any) => {
          if (req.url === '/api/save-world' && req.method === 'POST') {
            let data = ''
            req.on('data', (chunk: Buffer) => {
              data += chunk.toString()
            })
            req.on('end', () => {
              try {
                const body = JSON.parse(data)
                const publicDir = path.join(__dirname, 'public')
                if (!fs.existsSync(publicDir)) {
                  fs.mkdirSync(publicDir, { recursive: true })
                }
                const filePath = path.join(publicDir, 'world-data.json')
                fs.writeFileSync(filePath, JSON.stringify(body), 'utf-8')
                console.log(`\n✓ World data saved to public/world-data.json (${data.length} bytes)\n`)
                res.setHeader('Content-Type', 'application/json')
                res.writeHead(200)
                res.end(JSON.stringify({ success: true, message: 'World data saved' }))
              } catch (error) {
                console.error('Error saving world data:', error)
                res.setHeader('Content-Type', 'application/json')
                res.writeHead(500)
                res.end(JSON.stringify({ success: false, error: (error as any).message }))
              }
            })
          } else {
            next()
          }
        })
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), worldDataPlugin()],
  publicDir: 'public',
})