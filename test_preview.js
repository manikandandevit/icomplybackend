import { caPayrollRunsService } from './src/modules/CAPayrollRuns/caPayrollRuns.service.js';
import { db } from './src/core/db/pool.js';

caPayrollRunsService.getPreview(3, 10, 'October', '2026').then(res => {
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
