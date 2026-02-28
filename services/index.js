const MistralService = require('./mistral');
const ElevenLabsService = require('./elevenlabs');
const VibeService = require('./vibe');

const services = {};

async function initServices() {
  const registry = {
    mistral: new MistralService(),
    elevenlabs: new ElevenLabsService(),
    vibe: new VibeService(),
  };

  for (const [name, service] of Object.entries(registry)) {
    await service.init();
    services[name] = service;
  }

  console.log(`[Services] ${Object.keys(services).length} loaded:`, Object.keys(services).join(', '));
}

async function routeRequest(serviceName, input) {
  const service = services[serviceName];
  if (!service) {
    return { success: false, error: `Unknown service: ${serviceName}` };
  }
  if (!service.ready) {
    return { success: false, error: `Service ${serviceName} not ready` };
  }
  try {
    return await service.process(input);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getServiceNames() {
  return Object.keys(services);
}

module.exports = { initServices, routeRequest, getServiceNames };
