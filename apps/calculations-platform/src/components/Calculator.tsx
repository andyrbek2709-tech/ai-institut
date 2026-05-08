import { useEffect, useState } from 'react'
import { fetchTemplate, executeCalculation } from '../api/client'

interface SelectedTemplate {
  id: string
  name: string
}

interface TemplateData {
  metadata: {
    name: string
    description: string
    category: string
  }
  inputs: Array<{
    name: string
    description: string
    unit: string
    required: boolean
    min_value?: number
    max_value?: number
    default_value?: number
  }>
  outputs: Array<{
    name: string
    description: string
    unit: string
  }>
}

interface Props {
  template: SelectedTemplate
  onBack: () => void
}

export default function Calculator({ template, onBack }: Props) {
  const [templateData, setTemplateData] = useState<TemplateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState<Record<string, string>>({})
  const [result, setResult] = useState<Record<string, number> | null>(null)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const data = await fetchTemplate(template.id)
        setTemplateData(data)
        const initialValues: Record<string, string> = {}
        data.inputs.forEach(input => {
          initialValues[input.name] = input.default_value?.toString() || ''
        })
        setValues(initialValues)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load template')
      } finally {
        setLoading(false)
      }
    }

    loadTemplate()
  }, [template.id])

  const handleInputChange = (name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }

  const handleExecute = async () => {
    try {
      setExecuting(true)
      setError(null)

      const numericValues: Record<string, number> = {}
      Object.entries(values).forEach(([key, value]) => {
        numericValues[key] = parseFloat(value)
      })

      const result = await executeCalculation(template.id, numericValues)
      setResult(result.output_variables)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed')
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading template...</div>
  }

  if (!templateData) {
    return <div className="text-red-600">Failed to load template</div>
  }

  return (
    <div>
      <button onClick={onBack} className="text-brand-700 hover:underline mb-4">
        ← Back to Templates
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{templateData.metadata.name}</h1>
        <p className="text-gray-600">{templateData.metadata.description}</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Inputs */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Inputs</h2>
            <div className="space-y-4">
              {templateData.inputs.map(input => (
                <div key={input.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {input.description}
                    {input.required && <span className="text-red-600">*</span>}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={values[input.name] || ''}
                      onChange={(e) => handleInputChange(input.name, e.target.value)}
                      placeholder={input.default_value?.toString()}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-700 outline-none"
                    />
                    <span className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-gray-600 text-sm">
                      {input.unit}
                    </span>
                  </div>
                  {input.min_value !== undefined && input.max_value !== undefined && (
                    <p className="text-xs text-gray-500 mt-1">
                      Range: {input.min_value} - {input.max_value}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleExecute}
              disabled={executing}
              className="w-full mt-6 bg-brand-700 hover:bg-brand-600 disabled:bg-gray-400 text-white font-semibold py-3 rounded transition"
            >
              {executing ? 'Calculating...' : 'Calculate'}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Results</h2>
            <div className="space-y-4">
              {templateData.outputs.map(output => (
                <div key={output.name}>
                  <p className="text-sm text-gray-600">{output.description}</p>
                  <p className="text-2xl font-bold text-brand-700">
                    {result[output.name]?.toFixed(4) || '-'}
                  </p>
                  <p className="text-xs text-gray-500">{output.unit}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
