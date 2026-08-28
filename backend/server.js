'use strict';

/**
 * Backwards-compatible entry point.
 * The production server lives in server2.js; keeping this shim means
 * existing `node server.js` workflows continue to work during the migration.
 */
const runtime = require('./server2');

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  runtime.server.listen(port, () => console.log(`BattleBox listening on port ${port}`));
}

module.exports = runtime;
