import { createLandlordConsole } from '../../src/ui/console/controller.js';
import styles from './styles.css';

const buttonId = 'landlord-console';
const styleId = 'landlord-console-styles';
const buttonIcon = `<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M8 7h4M8 11h4M8 15h4M2 21h20M16 9h2a2 2 0 0 1 2 2v10"/></svg>`;

export function activate(context) {
  const store = context.services.require('landlord.store');
  const tasks = context.services.require('landlord.tasks');
  const events = context.services.require('landlord.events');
  const history = context.services.require('landlord.history');
  const spatialSync = context.services.require('landlord.spatialSync');
  const embodiment = context.services.require('tenant.embodiment');
  const perception = context.services.require('landlord.perception');
  const identities = context.services.require('landlord.identities');
  const layouts = context.services.require('building.layout');
  const operations = context.services.require('building.operations');
  const bridges = context.services.require('landlord.bridges');
  const compiler = context.services.require('building.compiler');
  const style = context.document.createElement('style');
  style.id = styleId;
  style.textContent = styles;
  context.document.head.appendChild(style);

  const consoleUi = createLandlordConsole({
    document: context.document,
    store,
    tasks,
    events,
    history,
    spatialSync,
    embodiment,
    perception,
    identities,
    layouts,
    operations,
    bridges,
    compiler,
    logger: context.logger,
  });
  const floatingMenu = context.legacy.get('FloatingMenuManager');
  let fallbackButton = null;

  if (floatingMenu?.registerButton) {
    floatingMenu.registerButton({
      id: buttonId,
      icon: buttonIcon,
      label: '房东经营中枢',
      onClick: () => consoleUi.open(),
      color: 'linear-gradient(135deg, #FF9EAA 0%, #7C6CE7 100%)',
      order: 1,
    });
  } else {
    fallbackButton = context.document.createElement('button');
    fallbackButton.type = 'button';
    fallbackButton.title = '房东经营中枢';
    fallbackButton.innerHTML = buttonIcon;
    fallbackButton.style.cssText = 'position:fixed;right:22px;bottom:92px;z-index:2147482000;width:52px;height:52px;border:3px solid white;border-radius:18px;background:linear-gradient(135deg,#FF9EAA,#7C6CE7);box-shadow:0 10px 25px rgba(82,47,67,.28);cursor:pointer;';
    fallbackButton.addEventListener('click', consoleUi.open);
    context.document.body.appendChild(fallbackButton);
  }

  context.services.register('landlord.console', consoleUi, { legacyGlobal: 'LandlordConsole' });
  return () => {
    floatingMenu?.unregisterButton?.(buttonId);
    if (fallbackButton) {
      fallbackButton.removeEventListener('click', consoleUi.open);
      fallbackButton.remove();
    }
    consoleUi.dispose();
    style.remove();
  };
}
