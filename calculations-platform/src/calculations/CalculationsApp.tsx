import React, { useEffect, useState } from 'react';
import { CalculationsHome } from './pages/CalculationsHome';
import { CalculationWorkspace } from './pages/CalculationWorkspace';
import { CalculationHistory } from './components/CalculationHistory';
import { DEMO_CALCULATIONS } from './data/demonstrations';
import { getHistory } from './storage/history';
import { HistoryEntry } from './types';

type AppView = 'home' | 'workspace' | 'upload' | 'history';

interface CalculationsAppProps {
  onClose?: () => void;
}

const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-2.5 py-1 rounded transition-colors text-xs font-medium ${
      active
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`}
  >
    {children}
  </button>
);

export const CalculationsApp: React.FC<CalculationsAppProps> = ({ onClose }) => {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [selectedCalculationId, setSelectedCalculationId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [presetInputs, setPresetInputs] = useState<Record<string, number> | undefined>(undefined);
  const [recentEntries, setRecentEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setRecentEntries(getHistory().slice(0, 5));
  }, [currentView]);

  const handleSelectCalculation = (calcId: string) => {
    setSelectedCalculationId(calcId);
    setPresetInputs(undefined);
    setCurrentView('workspace');
  };

  const handleOpenHistoryEntry = (entry: HistoryEntry) => {
    setSelectedCalculationId(entry.calculationId);
    setPresetInputs({ ...entry.inputs });
    setCurrentView('workspace');
  };

  const handleBackToHome = () => {
    switch (currentView) {
      case 'workspace':
        setSelectedCalculationId(null);
        setPresetInputs(undefined);
        setCurrentView('home');
        break;
      case 'home':
        if (selectedCategory !== null) {
          setSelectedCategory(null);
        }
        break;
      case 'history':
      case 'upload':
        setCurrentView('home');
        break;
    }
  };

  const isWorkspace = currentView === 'workspace' && !!selectedCalculationId;

  return (
    /* Root: полная высота экрана, flex-col — nav сверху, контент снизу */
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">

      {/* ── NAV ── shrink-0, высота зафиксирована */}
      <nav className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-30">
        <div className="px-3 py-1.5 flex items-center justify-between">
          <button
            onClick={handleBackToHome}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white hover:opacity-75 transition-opacity"
          >
            ⚙️ <span className="hidden sm:inline">Расчётная платформа</span>
          </button>

          <div className="flex items-center gap-1">
            <NavButton active={currentView === 'home'} onClick={() => setCurrentView('home')}>
              🏠 <span className="hidden sm:inline">Каталог</span>
            </NavButton>
            <NavButton active={currentView === 'history'} onClick={() => setCurrentView('history')}>
              📜 <span className="hidden sm:inline">История</span>
            </NavButton>
            <NavButton active={currentView === 'upload'} onClick={() => setCurrentView('upload')}>
              📤 <span className="hidden sm:inline">Загрузить</span>
              <span className="ml-1 text-[10px] text-amber-500">🚧</span>
            </NavButton>
            {onClose && (
              <button
                onClick={onClose}
                className="ml-1.5 px-2 py-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-xs"
                aria-label="Закрыть"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── BODY ── flex-1 min-h-0: занимает всё оставшееся место */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Sidebar — только на xl, только на главной */}
        {currentView === 'home' && (
          <aside className="hidden xl:flex xl:flex-col w-44 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-3 flex flex-col gap-3 min-h-0">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
                  Действия
                </p>
                <div className="space-y-1">
                  <button
                    onClick={() => setCurrentView('home')}
                    className="w-full px-2.5 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-xs text-left"
                  >
                    + Открыть каталог
                  </button>
                  <button
                    onClick={() => setCurrentView('upload')}
                    className="w-full px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs text-left"
                  >
                    📤 Загрузить методику 🚧
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0">
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
                  Последние
                </p>
                {recentEntries.length === 0 ? (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                    Пока пусто. Сохраните результат расчёта.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {recentEntries.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => handleOpenHistoryEntry(e)}
                        className="w-full text-left px-1.5 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="text-xs text-gray-800 dark:text-gray-200 truncate leading-tight">
                          {e.calculationName}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500">
                          {new Date(e.timestampISO).toLocaleString('ru-RU')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-[10px] text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-2">
                {DEMO_CALCULATIONS.length} расчётов · ГОСТ/СП/ПУЭ
              </div>
            </div>
          </aside>
        )}

        {/* ── MAIN CONTENT ── */}
        <div
          className={`flex-1 min-w-0 min-h-0 ${
            isWorkspace
              ? 'overflow-hidden flex flex-col'   /* workspace: колонки скроллятся сами */
              : 'overflow-y-auto'                  /* остальные: страница скроллится */
          }`}
        >
          {/* HOME */}
          {currentView === 'home' && (
            <div className="p-4 max-w-7xl mx-auto w-full pb-8">
              <CalculationsHome
                onSelectCalculation={handleSelectCalculation}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
              />
            </div>
          )}

          {/* WORKSPACE — без p-4 здесь, он внутри Workspace */}
          {isWorkspace && (
            <CalculationWorkspace
              calculationId={selectedCalculationId}
              onBack={handleBackToHome}
              presetInputs={presetInputs}
            />
          )}

          {/* UPLOAD */}
          {currentView === 'upload' && (
            <div className="p-4 max-w-2xl mx-auto w-full">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-start gap-4 mb-5">
                  <div className="text-4xl">🚧</div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      Загрузка методик расчёта
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Функция в разработке</p>
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-5 text-sm text-amber-900 dark:text-amber-100">
                  <p className="font-semibold mb-1">Что должно работать:</p>
                  <p>Загружаешь методичку (ГОСТ/СНиП/стандарт) в PDF, DOCX или XLSX → система распознаёт формулы, создаёт интерактивный расчёт в каталоге.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-5 text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-semibold mb-1">Почему пока недоступно:</p>
                  <p>Распознавание формул из PDF — отдельный проект EngHub Platform (PDF Parser Phase 3 / OCR Hardening). Архитектура спроектирована, реализация запланирована отдельным этапом.</p>
                </div>
                <button
                  onClick={() => setCurrentView('home')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  🏠 Перейти в каталог
                </button>
              </div>
            </div>
          )}

          {/* HISTORY */}
          {currentView === 'history' && (
            <div className="p-4 max-w-5xl mx-auto w-full pb-8">
              <CalculationHistory onOpenEntry={handleOpenHistoryEntry} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
