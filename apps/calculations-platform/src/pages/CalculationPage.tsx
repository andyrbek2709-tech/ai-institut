import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCalculationStore } from '@/stores/calculation'

interface CalcVariable {
  name: string
  label: string
  description: string
  unit: string
  data_type: string
  required: boolean
  min_value?: number
  max_value?: number
  choices?: string[]
}

interface Template {
  id: string
  name: string
  category: string
  description: string
  variables: CalcVariable[]
  formula: string
  outputs: string[]
  normative_reference: string
}

export const CalculationPage: React.FC = () => {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const store = useCalculationStore()

  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!templateId) return
      try {
        const response = await fetch(`/api/v1/templates/${templateId}`)
        if (!response.ok) throw new Error('Template not found')
        const data = await response.json()
        setTemplate(data)
        store.setSelectedTemplate(templateId)
      } catch (err) {
        setError('Failed to load template')
        navigate('/templates')
      } finally {
        setLoading(false)
      }
    }

    fetchTemplate()
  }, [templateId, navigate, store])

  const handleInputChange = (name: string, value: string) => {
    store.setInput(name, value)
  }

  const handleCalculate = async () => {
    if (!template) return

    store.setLoading(true)
    store.setError(null)

    try {
      const inputs = Object.entries(store.inputs).map(([name, value]) => ({
        name,
        value: parseFloat(value as string),
        unit: template.variables.find((v) => v.name === name)?.unit,
      }))

      const response = await fetch('/api/v1/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          inputs,
          unit_system: 'SI',
        }),
      })

      if (!response.ok) throw new Error('Calculation failed')
      const result = await response.json()
      store.setResults(result.results)
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Calculation failed')
    } finally {
      store.setLoading(false)
    }
  }

  if (loading) return <div>Loading template...</div>
  if (!template) return <div>Template not found</div>

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">{template.name}</h1>
      <p className="text-gray-600 mb-8">{template.description}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Inputs */}
        <div className="lg:col-span-2">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Inputs</h2>

            {error && <div className="mb-4 p-3 bg-error/10 text-error rounded">{error}</div>}

            <div className="space-y-4">
              {template.variables.map((variable) => (
                <div key={variable.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {variable.label}
                    {variable.required && <span className="text-error ml-1">*</span>}
                  </label>
                  <p className="text-xs text-gray-500 mb-2">{variable.description}</p>
                  <div className="flex gap-2">
                    <input
                      type={variable.data_type === 'float' ? 'number' : 'text'}
                      step={variable.data_type === 'float' ? '0.01' : undefined}
                      value={store.inputs[variable.name] || ''}
                      onChange={(e) => handleInputChange(variable.name, e.target.value)}
                      placeholder={`Min: ${variable.min_value}, Max: ${variable.max_value}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded"
                    />
                    <span className="flex items-center px-3 py-2 bg-gray-50 text-gray-600 text-sm">
                      {variable.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleCalculate}
              disabled={store.loading}
              className="mt-6 w-full bg-primary text-white py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {store.loading ? 'Calculating...' : 'Calculate'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Results</h2>

            {store.results ? (
              <div className="space-y-4">
                {Object.entries(store.results).map(([key, value]) => (
                  <div key={key} className="p-3 bg-success/10 rounded">
                    <p className="text-xs text-gray-600 mb-1">{key}</p>
                    <p className="text-2xl font-bold text-success">
                      {typeof value === 'number' ? value.toFixed(2) : value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No results yet</p>
            )}

            {template.normative_reference && (
              <div className="mt-6 p-3 bg-gray-50 rounded text-xs">
                <p className="text-gray-600">
                  <strong>Reference:</strong> {template.normative_reference}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
