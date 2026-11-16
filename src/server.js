import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { caLeaveYearBalancesService } from "./modules/CALeaveYearBalances/caLeaveYearBalances.service.js";

// Reloaded server to apply recent notifications and interactive modal fix
const app = createApp();

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`iComply API running on http://localhost:${config.port}`);
  // Run the yearly leave-balance roll-forward a little after startup, so it
  // doesn't compete with the first user requests for DB connections.
  const rollForwardTimer = setTimeout(() => {
    void caLeaveYearBalancesService.rollForwardAll().catch((error) => {
      console.error("Leave year balance roll-forward failed", error);
    });
  }, 60 * 1000);
  rollForwardTimer.unref();
});

const cleanup = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

