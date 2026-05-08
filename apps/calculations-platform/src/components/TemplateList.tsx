import { useEffect, useState } from 'react'
import { fetchTemplates } from '../api/client'

interface Template {
  id: string
  name: string
  description: string
  category: string
  version: string
}

interface Props {
  onSelectTemplate: (templateId: string, templateName: string) => void
}

export default function TemplateList({ onSelectTemplate }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true)
        const data = await fetchTemplates()
        setTemplates(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates')
      } finally {
        setLoading(false)
      }
    }

    loadTemplates()
  }, [])

  if (loading) {
    return <div className="text-center py-12">Loading templates...</div>
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>
  }

  // Group by category
  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = []
    }
    acc[template.category].push(template)
    return acc
  }, {} as Record<string, Template[]>)

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Calculations</h1>
      <p className="text-gray-600 mb-8">Select a calculation template to get started</p>

      {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
        <div key={category} className="mb-8">
          <h2 className="text-xl font-semibold text-brand-700 mb-4">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template.id, template.name)}
                className="p-6 bg-white border border-gray-200 rounded-lg hover:border-brand-700 hover:shadow-lg transition text-left"
              >
                <h3 className="font-semibold text-lg mb-2 text-gray-900">{template.name}</h3>
                <p className="text-gray-600 text-sm mb-3">{template.description}</p>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{template.category}</span>
                  <span>v{template.version}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
