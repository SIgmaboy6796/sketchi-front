import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default function worldDataPlugin() {
  return {
    name: 'world-data-saver',
    apply: 'serve',
    configureServer(server) {
      return () => {
        // Add raw body parser middleware
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/save-world' && req.method === 'POST') {
            let data = ''
            req.on('data', chunk => {
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
                res.end(JSON.stringify({ success: false, error: error.message }))
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
