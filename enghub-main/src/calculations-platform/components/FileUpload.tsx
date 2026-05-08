import React, { useState, useRef } from 'react';

interface FileUploadProps {
  onFileSelected?: (file: File) => void;
  acceptedTypes?: string[];
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelected,
  acceptedTypes = ['.pdf', '.docx', '.xlsx'],
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setUploadedFile(file);
    onFileSelected?.(file);

    // Simulate upload progress
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 30;
      });
    }, 200);
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:border-blue-400'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={(e) => e.target.files && handleFileSelected(e.target.files[0])}
          className="hidden"
        />

        {!uploadedFile ? (
          <>
            {/* Upload Icon */}
            <div className="text-4xl mb-3">📤</div>

            {/* Text */}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Загрузите файл расчёта
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Поддерживаются форматы: PDF, DOCX, XLSX
            </p>

            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium mb-3"
            >
              Выбрать файл
            </button>

            {/* Or divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">или</span>
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Перетащите файл сюда
            </p>
          </>
        ) : (
          <>
            {/* File Preview */}
            <div className="text-4xl mb-3">✅</div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Файл загружен
            </h3>

            {/* File Details */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-4 text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">
                  {uploadedFile.name.endsWith('.pdf') && '📄'}
                  {uploadedFile.name.endsWith('.docx') && '📝'}
                  {uploadedFile.name.endsWith('.xlsx') && '📊'}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {uploadedFile.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} МБ
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setUploadedFile(null);
                  setUploadProgress(0);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm"
              >
                Отменить
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                Обработать файл
              </button>
            </div>
          </>
        )}
      </div>

      {/* File Info */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>✓ Максимальный размер: 50 МБ</p>
        <p>✓ Форматы: PDF (сканы, отчёты), DOCX (методики), XLSX (таблицы)</p>
        <p>✓ Файлы обрабатываются автоматически в фоновом режиме</p>
      </div>
    </div>
  );
};
