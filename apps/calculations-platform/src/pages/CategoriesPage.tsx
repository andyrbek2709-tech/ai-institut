import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface Category {
  name: string
  count: number
}

export const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/v1/templates/categories')
        const data = await response.json()
        setCategories(data.categories || [])
      } catch (err) {
        setError('Failed to load categories')
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [])

  if (loading) {
    return <div className="text-center py-12">Loading categories...</div>
  }

  if (error) {
    return <div className="text-center py-12 text-error">{error}</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Calculation Categories</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => (
          <Link
            key={cat.name}
            to={`/templates?category=${cat.name}`}
            className="bg-white p-6 rounded-lg border border-gray-200 hover:border-primary hover:shadow-lg transition"
          >
            <h3 className="text-xl font-semibold text-primary mb-2">
              {cat.name}
            </h3>
            <p className="text-gray-600">
              {cat.count} template{cat.count !== 1 ? 's' : ''}
            </p>
          </Link>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No categories found
        </div>
      )}
    </div>
  )
}
