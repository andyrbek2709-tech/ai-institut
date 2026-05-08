import React, { useState } from 'react';

export const FileUpload: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (validTypes.includes(file.type)) {
      setSelectedFile(file);
    } else {
      alert('Пожалуйста, загрузите файл в формате PDF, DOCX или XLSX');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/calculations/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        alert('Файл успешно загружен и обработан');
        setSelectedFile(null);
      } else {
        alert('Ошибка при загрузке файла');
      }
    } catch (error) {
      alert('Ошибка сети при загрузке файла');
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
        }`}
      >
        <div className="text-4xl mb-3">📄</div>
        <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Перетащите файл сюда
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          или
        </p>
        <label className="inline-block">
          <input
            type="file"
            onChange={handleInputChange}
            accept=".pdf,.docx,.xlsx"
            className="hidden"
          />
          <span className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors font-medium">
            Выберите файл
          </span>
        </label>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-4">
          Поддерживаемые форматы: PDF, DOCX, XLSX (макс. 10 МБ)
        </p>
      </div>

      {selectedFile && (
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                ✓ Файл выбран
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} МБ)
              </p>
            </div>
            <button
              onClick={handleUpload}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
            >
              📤 Загрузить
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
