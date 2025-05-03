// Function to parse URL parameters
function getUrlParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search)
  const result: Record<string, string> = {}
  
  // Convert URLSearchParams to a plain object
  params.forEach((value, key) => {
    result[key] = value
  })
  
  return result
}

// Display the parameters on the page
function displayParams(): void {
  const params = getUrlParams()
  const paramsDisplay = document.getElementById('params-display')
  
  if (paramsDisplay) {
    if (Object.keys(params).length === 0) {
      paramsDisplay.innerHTML = '<p>No URL parameters found</p>'
    } else {
      paramsDisplay.innerHTML = `
        <h2>URL Parameters:</h2>
        <pre>${JSON.stringify(params, null, 2)}</pre>
      `
      
      // Apply any special handling based on params
      // For example, if there's a mode parameter with value 'dark'
      if (params.mode === 'dark') {
        document.body.style.backgroundColor = '#222'
        document.body.style.color = '#fff'
      }
    }
  }
}

// Run when the page loads
document.addEventListener('DOMContentLoaded', displayParams)