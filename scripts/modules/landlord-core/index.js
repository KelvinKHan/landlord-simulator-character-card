import { compileBuilding, compilePortfolio } from '../../src/buildings/compiler.js';
import { managementMockRecipes } from '../../src/mock/management-recipes.js';
import { createLandlordStore } from '../../src/services/landlord-store.js';
import { createMockTaskService } from '../../src/services/mock-task-service.js';

export function activate(context) {
  const schema = context.services.require('landlord.schema');
  const store = createLandlordStore({ mvu: context.mvu, schema });
  const tasks = createMockTaskService({ recipes: managementMockRecipes });
  const compiler = Object.freeze({ compileBuilding, compilePortfolio });

  context.services.register('landlord.store', store, { legacyGlobal: 'LandlordStore' });
  context.services.register('landlord.tasks', tasks);
  context.services.register('building.compiler', compiler);
}
