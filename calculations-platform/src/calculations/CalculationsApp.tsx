import React, { useState } from 'react';
import { CalculationsHome } from './pages/CalculationsHome';
import { CalculationWorkspace } from './pages/CalculationWorkspace';
import { FileUpload } from './components/FileUpload';
import { ReportGenerator } from './components/ReportGenerator';
import { CalculationHistory } from './components/CalculationHistory';
import { DEMO_CALCULATIONS } from './data/demonstrations';

type AppView = 'home' | 'workspace' | 'upload' | 'history';

interface CalculationsAppProps {
  onClose?: () => void;
}

export const CalculationsApp: React.FC<CalculationsAppProps> = ({ onClose }) => {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [selectedCalculationId, setSelectedCalculationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSelectCalculation = (calcId: string) => {
    setSelectedCalculationId(calcId);
    setCurrentView('workspace');
  };

  const handleBackToHome = () => {
    setSelectedCalculationId(null);
    setCurrentView('home');
  };

  const currentCalculation = DEMO_CALCULATIONS.find(
    (c) => c.id === selectedCalculationId,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-lg"
            >
              ☰
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              ⚙️ Расчётная платформа
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView('home')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                currentView === 'home'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              🏠 Главная
            </button>
            <button
              onClick={() => setCurrentView('history')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                currentView === 'history'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              📜 История
            </button>
            <button
              onClick={() => setCurrentView('upload')}
              className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                currentView === 'upload'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              📤 Загрузить
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="flex">
        {sidebarOpen && currentView === 'home' && (
          <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 hidden lg:block">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              ⚡ Быстрые действия
            </h2>
            <div className="space-y-3">
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                + Новый расчёт
              </button>
              <button className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-sm">
                📤 Загрузить PDF/DOCX
              </button>
              <button className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-sm">
                📊 Экспортировать результат
              </button>
            </div>

            <hr className="my-6 border-gray-200 dark:border-gray-700" />

            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 text-sm">
              Недавние расчёты
            </h3>
            <div className="space-y-2">
              {DEMO_CALCULATIONS.slice(0, 3).map((calc) => (
                <button
                  key={calc.id}
                  onClick={() => handleSelectCalculation(calc.id)}
                  className="w-full text-left p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
                >
                  {calc.name.slice(0, 25)}...
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 p-6">
          {currentView === 'home' && (
            <CalculationsHome onSelectCalculation={handleSelectCalculation} />
          )}

          {currentView === 'workspace' && selectedCalculationId && (
            <div>
              <CalculationWorkspace
                calculationId={selectedCalculationId}
                onBack={handleBackToHome}
              />
            </div>
          )}

          {currentView === 'upload' && (
            <div className="max-w-2xl">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  📤 Загрузка файлов расчётов
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  Загрузите методику расчёта или результаты в PDF, DOCX или XLSX формате.
                  Система автоматически распознает формулы и параметры.
                </p>

                <FileUpload />

                <hr className="my-8 border-gray-200 dark:border-gray-700" />

                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  📋 Что произойдёт после загрузки?
                </h2>
                <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-600 dark:text-blue-400">1.</span>
                    <span>Система распознает документ и извлекает формулы</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-600 dark:text-blue-400">2.</span>
                    <span>
                      Проверит расчёты и обозначит найденные переменные
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-600 dark:text-blue-400">3.</span>
                    <span>Создаст интерактивную форму для ввода параметров</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-blue-600 dark:text-blue-400">4.</span>
                    <span>
                      Позволит вам генерировать отчёты с новыми значениями
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          )}

          {currentView === 'history' && (
            <div className="max-w-5xl">
              <CalculationHistory onSelectCalculation={handleSelectCalculation} />
            </div>
          )}
        </div>
      </div>

      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
          <div>
            © 2026 EngHub Calculations Platform. Все расчёты соответствуют ГОСТам и строительным
            нормам.
          </div>
          <div className="flex gap-4">
            <button className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Справка
            </button>
            <button className="hover:text-gray-900 dark:hover:text-white transition-colors">
              О платформе
            </button>
            <button className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Контакты
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
