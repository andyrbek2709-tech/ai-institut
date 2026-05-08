import { useState } from 'react'
import Layout from './components/Layout'
import TemplateList from './components/TemplateList'
import Calculator from './components/Calculator'

type Page = 'templates' | 'calculator'

interface SelectedTemplate {
  id: string
  name: string
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('templates')
  const [selectedTemplate, setSelectedTemplate] = useState<SelectedTemplate | null>(null)

  const handleSelectTemplate = (templateId: string, templateName: string) => {
    setSelectedTemplate({ id: templateId, name: templateName })
    setCurrentPage('calculator')
  }

  const handleBackToTemplates = () => {
    setCurrentPage('templates')
    setSelectedTemplate(null)
  }

  return (
    <Layout>
      {currentPage === 'templates' ? (
        <TemplateList onSelectTemplate={handleSelectTemplate} />
      ) : selectedTemplate ? (
        <Calculator template={selectedTemplate} onBack={handleBackToTemplates} />
      ) : null}
    </Layout>
  )
}
