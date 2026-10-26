import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { caLeaveYearBalancesService } from "./modules/CALeaveYearBalances/caLeaveYearBalances.service.js";

// Reloaded server to apply job requisition service updates
const app = createApp();

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`iComply API running on http://localhost:${config.port}`);
  void caLeaveYearBalancesService.rollForwardAll().catch((error) => {
    console.error("Leave year balance roll-forward failed", error);
  });
});

const cleanup = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

