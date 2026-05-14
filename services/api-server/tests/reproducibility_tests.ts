import { describe, it, expect } from '@jest/globals';
import { ReportLifecycleManager, ReportData } from '../src/services/reportManager.js';

const reportManager = new ReportLifecycleManager();

describe('ReportLifecycleManager - Reproducibility (Stage 2)', () => {
  it('Должен генерировать идентичные checksum для одинаковых входных данных', async () => {
    const baseData: Omit<ReportData, 'userId'> = {
      projectId: 1,
      discipline: 'Промбезопасность',
      content: 'Расчет отказоустойчивости...',
      contextSnapshot: {
        tzVersion: 'v1.2.3',
        normativeReferences: ['ГОСТ 12.1.004-91', 'СНиП 2.01.02-85'],
      },
    };

    // Генерируем три отчета с одинаковыми данными
    const report1 = await reportManager.generateReport({ ...baseData, userId: 'user-1' });
    const report2 = await reportManager.generateReport({ ...baseData, userId: 'user-1' });
    const report3 = await reportManager.generateReport({ ...baseData, userId: 'user-1' });

    // Все хеши должны быть идентичны
    expect(report1.checksum).toBe(report2.checksum);
    expect(report2.checksum).toBe(report3.checksum);
  });

  it('Должен игнорировать порядок ссылок на нормативы при расчете хеша', async () => {
    const baseData: Omit<ReportData, 'userId'> = {
      projectId: 1,
      discipline: 'Промбезопасность',
      content: 'Расчет отказоустойчивости...',
    };

    const refs1 = ['ГОСТ 12.1.004-91', 'СНиП 2.01.02-85'];
    const refs2 = ['СНиП 2.01.02-85', 'ГОСТ 12.1.004-91']; // Обратный порядок

    const report1 = await reportManager.generateReport({
      ...baseData,
      userId: 'user-1',
      contextSnapshot: { tzVersion: 'v1.2.3', normativeReferences: refs1 }
    });

    const report2 = await reportManager.generateReport({
      ...baseData,
      userId: 'user-1',
      contextSnapshot: { tzVersion: 'v1.2.3', normativeReferences: refs2 }
    });

    // Хеши должны быть идентичны, несмотря на разный порядок ссылок
    expect(report1.checksum).toBe(report2.checksum);
  });

  it('Должен генерировать разные checksum для разного контекста', async () => {
    const baseData: Omit<ReportData, 'userId'> = {
      projectId: 1,
      discipline: 'Промбезопасность',
      content: 'Расчет отказоустойчивости...',
    };

    const report1 = await reportManager.generateReport({
      ...baseData,
      userId: 'user-1',
      contextSnapshot: { tzVersion: 'v1.2.3', normativeReferences: ['ГОСТ 12.1.004-91'] }
    });

    const report2 = await reportManager.generateReport({
      ...baseData,
      userId: 'user-1',
      contextSnapshot: { tzVersion: 'v1.2.4', normativeReferences: ['ГОСТ 12.1.004-91'] } // Другая версия ТЗ
    });

    // Хеши должны отличаться
    expect(report1.checksum).not.toBe(report2.checksum);
  });
});
