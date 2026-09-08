import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { caLeaveYearBalancesService } from "./modules/CALeaveYearBalances/caLeaveYearBalances.service.js";

const app = createApp();

app.listen(config.port, "0.0.0.0", () => {
  console.log(`iComply API running on http://localhost:${config.port}`);
  void caLeaveYearBalancesService.rollForwardAll().catch((error) => {
    console.error("Leave year balance roll-forward failed", error);
  });
});
