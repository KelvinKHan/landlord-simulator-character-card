import { createRecipeTaskProvider, createTaskCenter } from './task-center.js';

export function createMockTaskService({ recipes, idFactory }) {
  return createTaskCenter({
    providers: {
      local: createRecipeTaskProvider({ id: 'management-local', recipes, source: 'local-mock' }),
    },
    defaultMode: 'local',
    idFactory,
  });
}
