// vite.config.ts with a custom middleware plugin
import { defineConfig, Plugin } from 'vite'
import { resolve } from 'path'
import fs from 'fs'

// Custom plugin to handle clean URLs
function cleanUrls(): Plugin {
  return {
    name: 'clean-urls',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Handle specific routes
        if (req.url === '/nested') {
          // Rewrite to the actual file path
          req.url = '/pages/nested/index.html'
        }
        // Add more routes as needed:
        // else if (req.url === '/another-route') {
        //   req.url = '/pages/another-route/index.html'
        // }
        
        next()
      })
    }
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  
  // Use our custom plugin for URL rewriting
  plugins: [cleanUrls()],
  
  // Build configuration for production
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        nested: resolve(__dirname, 'pages/nested/index.html')
      }
    }
  }
})