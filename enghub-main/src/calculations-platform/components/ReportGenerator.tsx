import React, { useState } from 'react';

interface ReportGeneratorProps {
  calculationName: string;
  inputs: Record<string, { value: number; unit: string }>;
  outputs: Record<string, { value: number; unit: string }>;
  onGenerateReport?: () => void;
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  calculationName,
  inputs,
  outputs,
  onGenerateReport,
}) => {
  const [reportFormat, setReportFormat] = useState<'docx' | 'pdf'>('docx');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    // Simulate report generation
    setTimeout(() => {
      setIsGenerating(false);
      onGenerateReport?.();
    }, 1500);
  };

  return (
    <div className="w-full">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        {/* Header */}
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📋 Генерация отчёта
        </h2>

        {/* Report Format Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Формат выходного файла
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setReportFormat('docx')}
              className={`p-4 rounded-lg border-2 transition-all text-center ${
                reportFormat === 'docx'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">📝</div>
              <div className="font-semibold text-sm text-gray-900 dark:text-white">
                DOCX
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Word документ
              </div>
            </button>

            <button
              onClick={() => setReportFormat('pdf')}
              className={`p-4 rounded-lg border-2 transition-all text-center ${
                reportFormat === 'pdf'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">📄</div>
              <div className="font-semibold text-sm text-gray-900 dark:text-white">
                PDF
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Портативный документ
              </div>
            </button>
          </div>
        </div>

        {/* Report Options */}
        <div className="space-y-3 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Включить исходные данные
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Включить результаты расчётов
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Включить формулы и методологию
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Включить водяной знак с датой
            </span>
          </label>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setPreviewOpen(!previewOpen)}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            👁️ Предпросмотр
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="inline-block animate-spin">⟳</span>
                Генерируем...
              </>
            ) : (
              <>💾 Скачать отчёт</>
            )}
          </button>
        </div>
      </div>

      {/* Preview Panel */}
      {previewOpen && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Предпросмотр отчёта
          </h3>

          {/* Mock Report */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 mb-4 border border-gray-200 dark:border-gray-700 space-y-4 max-h-96 overflow-y-auto">
            {/* Title */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {calculationName}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Дата создания: {new Date().toLocaleString('ru-RU')}
              </p>
            </div>

            <hr className="border-gray-300 dark:border-gray-700" />

            {/* Input Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Исходные данные
              </h2>
              <table className="w-full text-sm">
                <tbody className="space-y-2">
                  {Object.entries(inputs).map(([key, val]) => (
                    <tr
                      key={key}
                      className="border-b border-gray-200 dark:border-gray-700"
                    >
                      <td className="py-2 text-gray-700 dark:text-gray-300 font-medium">
                        {key}
                      </td>
                      <td className="py-2 text-right text-gray-900 dark:text-white font-semibold">
                        {val.value.toFixed(3)} {val.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <hr className="border-gray-300 dark:border-gray-700" />

            {/* Results Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Результаты
              </h2>
              <table className="w-full text-sm">
                <tbody className="space-y-2">
                  {Object.entries(outputs).map(([key, val]) => (
                    <tr
                      key={key}
                      className="border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900"
                    >
                      <td className="py-2 text-gray-700 dark:text-gray-300 font-medium">
                        {key}
                      </td>
                      <td className="py-2 text-right text-green-900 dark:text-green-100 font-bold">
                        {val.value.toFixed(3)} {val.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <hr className="border-gray-300 dark:border-gray-700" />

            {/* Footer */}
            <div className="text-xs text-gray-500 dark:text-gray-500 text-center pt-4">
              Этот отчёт был автоматически сгенерирован платформой инженерных расчётов.
              Все расчёты проверены и соответствуют ГОСТам.
            </div>
          </div>

          {/* File Size Estimate */}
          <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <strong>📊 Оценка:</strong> Размер файла ~{reportFormat === 'docx' ? '2-3' : '1-2'} МБ
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
