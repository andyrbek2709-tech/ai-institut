import axios from 'axios'

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : '/api'

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

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
