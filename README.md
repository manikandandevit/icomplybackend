# iComply Backend

Node.js Express API with modular, layered architecture.

```
src/
  config/                 env and app settings
  core/                   shared errors, middleware, response contract
  modules/Login/          feature vertical slice
    login.routes.js
    login.middleware.js
    login.controller.js
    login.service.js
    login.validator.js
  app.js
  server.js
```

Request flow: **Route → Middleware → Controller → Service**

## Run

```bash
npm install
npm run dev
```

API base: `http://localhost:4000`

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/login` | No |
| GET | `/api/login/profile` | Bearer token |
| GET | `/api/health` | No |

Demo accounts: `admin@icomply.com` / `Admin@123` and `user@icomply.com` / `User@123`
