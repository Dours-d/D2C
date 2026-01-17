const routes = require('../../../src/routes');

const setupRoutes = (app) => {
  app.use('/api', routes);
};

module.exports = {
  setupRoutes
};
