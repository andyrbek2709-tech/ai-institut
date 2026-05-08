import axios, { AxiosError } from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '/api')
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000')

const client = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Error handling
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const message = (error.response.data as any)?.detail || error.response.statusText
      console.error(`API Error [${error.response.status}]: ${message}`)
    } else if (error.request) {
      console.error('No response from server')
    } else {
      console.error('Error:', error.message)
    }
    return Promise.reject(error)
  }
)

export const fetchTemplates = async () => {
  const response = await client.get('/templates/')
  return response.data
}

export const fetchTemplate = async (templateId: string) => {
  const response = await client.get(`/templates/${templateId}`)
  return response.data
}

export const executeCalculation = async (templateId: string, variables: Record<string, number>) => {
  const response = await client.post('/calculations/calculate', {
    template_id: templateId,
    variables,
  })
  return response.data
}

export const validateCalculation = async (templateId: string, variables: Record<string, number>) => {
  const response = await client.post('/calculations/validate', {
    template_id: templateId,
    variables,
  })
  return response.data
}

export const checkApiHealth = async () => {
  const response = await client.get('/health')
  return response.data
}
