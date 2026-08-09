import { createManagementAiProvider } from '../../src/ai/management-ai-provider.js';
import { compileBuilding, compilePortfolio } from '../../src/buildings/compiler.js';
import { createBuildingLayoutService } from '../../src/buildings/layout-engine.js';
import { createBuildingOperationsService } from '../../src/buildings/operations-engine.js';
import { createRenovationVisualService } from '../../src/renovation/visual-engine.js';
import { createSpatialRouteService } from '../../src/spatial/route-engine.js';
import { createBuildingEventBus } from '../../src/events/building-event-bus.js';
import { managementMockRecipes } from '../../src/mock/management-recipes.js';
import { createLandlordStore } from '../../src/services/landlord-store.js';
import { createOperationJournal } from '../../src/services/operation-journal-service.js';
import { createSpatialSyncService } from '../../src/services/spatial-sync-service.js';
import { createPerceptionService } from '../../src/services/perception-service.js';
import { createTenantIdentityService } from '../../src/services/tenant-identity-service.js';
import { createChannelBridgeService, createLegacyChannelPorts } from '../../src/services/channel-bridge-service.js';
import { createRecipeTaskProvider, createTaskCenter } from '../../src/services/task-center.js';

export function activate(context) {
  const schema = context.services.require('landlord.schema');
  const store = createLandlordStore({ mvu: context.mvu, schema });
  const localProvider = createRecipeTaskProvider({
    id: 'management-local',
    recipes: managementMockRecipes,
    source: 'local-mock',
  });
  const aiProvider = createManagementAiProvider({
    tavern: context.tavern,
    isEnabled: () => store.getState().运行模式 === '真实',
    logger: context.logger,
  });
  const tasks = createTaskCenter({
    providers: { local: localProvider, ai: aiProvider },
    defaultMode: 'local',
    concurrency: 1,
    timeoutMs: 45_000,
    maxAttempts: 2,
  });
  const compiler = Object.freeze({ compileBuilding, compilePortfolio });
  const events = createBuildingEventBus({ store });
  const history = createOperationJournal({ store });
  const perception = createPerceptionService({ store });
  const identities = createTenantIdentityService({ store });
  const layouts = createBuildingLayoutService();
  const operations = createBuildingOperationsService();
  const renovationVisuals = createRenovationVisualService();
  const routes = createSpatialRouteService();
  const spatialSync = createSpatialSyncService({ store });
  const bridges = createChannelBridgeService({
    events,
    identities,
    ports: createLegacyChannelPorts({ getLegacy: name => context.legacy.get(name), logger: context.logger }),
  });

  context.services.register('landlord.store', store, { legacyGlobal: 'LandlordStore' });
  context.services.register('landlord.tasks', tasks);
  context.services.register('landlord.events', events);
  context.services.register('landlord.history', history);
  context.services.register('landlord.perception', perception);
  context.services.register('landlord.identities', identities);
  context.services.register('building.layout', layouts);
  context.services.register('building.operations', operations);
  context.services.register('building.renovationVisual', renovationVisuals);
  context.services.register('building.routes', routes);
  context.services.register('landlord.spatialSync', spatialSync);
  context.services.register('landlord.bridges', bridges);
  context.services.register('building.compiler', compiler);
  context.lifecycle.onDispose(() => tasks.dispose());
  context.lifecycle.onDispose(() => events.dispose());
  context.lifecycle.onDispose(() => history.dispose());
  context.lifecycle.onDispose(() => spatialSync.dispose());
}
