import { TaskScheduler } from '../src/core/task-scheduler.js';

export function activate(context) {
  const scheduler = new TaskScheduler();
  context.services.register('analysis.scheduler', scheduler, {
    legacyGlobal: 'AnalysisScheduler',
  });
  context.logger.info('分析调度器已就绪');
  return () => scheduler.dispose();
}
