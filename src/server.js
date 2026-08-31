import { createApp } from "./app.js";
import { config } from "./config/index.js";

const app = createApp();

app.listen(config.port, "0.0.0.0", () => {
  console.log(`iComply API running on http://localhost:${config.port}`);
});
