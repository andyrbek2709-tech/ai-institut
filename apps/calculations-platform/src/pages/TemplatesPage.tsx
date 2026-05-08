import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

interface Template {
  id: string
  name: string
  category: string
  description: string
  tags: string[]
}

export const TemplatesPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const category = searchParams.get('category')

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/v1/templates')
        const data = await response.json()
        let items = data.templates || []

        if (category) {
          items = items.filter((t: Template) => t.category === category)
        }

        setTemplates(items)
      } catch (err) {
        setError('Failed to load templates')
      } finally {
        setLoading(false)
      }
    }

    fetchTemplates()
  }, [category])

  if (loading) {
    return <div className="text-center py-12">Loading templates...</div>
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {category ? `${category} Templates` : 'All Templates'}
        </h1>
        {error && <p className="text-error">{error}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((template) => (
          <Link
            key={template.id}
            to={`/calculate/${template.id}`}
            className="bg-white p-6 rounded-lg border border-gray-200 hover:border-primary hover:shadow-lg transition"
          >
            <h3 className="text-xl font-semibold text-primary mb-2">
              {template.name}
            </h3>
            <p className="text-gray-600 mb-4">{template.description}</p>
            <div className="flex flex-wrap gap-2">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No templates found
        </div>
      )}
    </div>
  )
}
