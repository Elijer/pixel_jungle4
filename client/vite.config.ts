// vite.config.ts with custom server middleware to handle URL parameters
import { defineConfig, Plugin } from 'vite'
import { resolve } from 'path'

// Custom plugin to handle URLs with parameters
function urlParamsPlugin(): Plugin {
  return {
    name: 'url-params-plugin',
    configureServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          // Extract base path without query parameters
          const url = req.url || ''
          const [basePath] = url.split('?')
          
          // Handle specific routes, preserving query parameters
          if (basePath === '/nested') {
            // Change just the path part, keeping the query string intact
            req.url = url.replace('/nested', '/pages/nested/index.html')
            console.log(`Rewrote URL: ${url} -> ${req.url}`)
          }
          
          next()
        })
      }
    }
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  
  // Use our custom plugin for handling URLs with parameters
  plugins: [urlParamsPlugin()],
  
  // Still mark as MPA for proper build handling
  appType: 'mpa',
  
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        nested: resolve(__dirname, 'pages/nested/index.html')
      }
    }
  }
})