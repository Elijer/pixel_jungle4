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

console.log(getUrlParams())