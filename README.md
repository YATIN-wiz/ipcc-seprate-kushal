# ProctorShield

ProctorShield is a proctoring platform that combines a FastAPI backend, Redis-based queueing, PostgreSQL persistence, MinIO evidence storage, LiveKit video transport, Judge0 code execution, and a React + Tauri desktop client.

This repository is organized as a local development stack plus a desktop client. The recommended path for most development is:

1. Start the infrastructure with Docker Compose.
2. Run the Python backend separately.
3. Run the React/Tauri client from `client/`.

## What You Need Installed

### Required software

- Git
- Docker Desktop with Docker Compose
- Python 3.10 or newer, preferably 3.11
- Node.js 20 LTS or newer
- npm
- Rust stable toolchain with Cargo
- Microsoft Visual C++ Build Tools on Windows
- Microsoft Edge WebView2 Runtime on Windows
- mkcert for local HTTPS certificate generation

### Required if you are on Windows

The client side of this project uses Tauri, and the current codebase is clearly Windows-oriented in a few places. On Windows you should install:

- Visual Studio Build Tools with the Desktop development with C++ workload
- Windows 10 or Windows 11, 64-bit
- WebView2 Runtime

### Recommended optional tools

- PostgreSQL client tools for troubleshooting
- Redis CLI for checking queue health
- curl or PowerShell Invoke-WebRequest for health checks

## What The System Uses

### Backend stack

- FastAPI for HTTP APIs
- Uvicorn as the ASGI server
- asyncpg for PostgreSQL access
- redis-py for Redis access
- LiveKit APIs for media integration
- OpenCV and NumPy for frame and image processing
- Triton client for model inference integration
- PyJWT for token handling

### Frontend stack

- React
- Vite
- Tauri
- LiveKit React components
- TensorFlow.js / face-api.js dependencies for browser-side features

### Infrastructure stack

- PostgreSQL 15
- Redis 7
- MinIO
- LiveKit server
- LiveKit Egress
- Judge0

## Repository Layout

- `backend/` contains the FastAPI app, AI workers, routers, and Python requirements.
- `client/` contains the active React/Tauri desktop application.
- `docker-compose.yml` starts the local infrastructure stack.
- `docker-compose.prod.yml` is a smaller production-oriented stack.
- `setup_enterprise.ps1` can generate supporting config and folders.

## Local Development Setup

### 1. Clone the repository

```powershell
git clone <your-repo-url>
cd proctorshield
```

### 2. Start the infrastructure

The default `docker-compose.yml` starts Redis, PostgreSQL, MinIO, LiveKit, LiveKit Egress, and Judge0.

```powershell
docker compose up -d
```

If you want to inspect the stack:

```powershell
docker compose ps
docker compose logs --tail 50 redis
docker compose logs --tail 50 postgres
```

### 3. Prepare the backend Python environment

The backend dependencies are listed in `backend/requirements.txt`.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Run the backend

The main FastAPI entrypoint is `backend/main.py`.

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend expects PostgreSQL at `localhost:5435` when you use the root Docker Compose file, because the container maps port `5432` to host port `5435`.

### 5. Install the client dependencies

The active desktop client lives in `client/`.

```powershell
cd ..\client
npm install
```

### 6. Generate local HTTPS certificates for Vite

`client/vite.config.js` expects `cert.key` and `cert.crt` in the `client/` directory.

If they are missing, generate them with `mkcert` or the project setup you already use. The Vite dev server will not start cleanly without those files.

### 7. Run the client

For the web dev server:

```powershell
npm run dev
```

For the Tauri desktop app:

```powershell
npm run tauri dev
```

## Production-Oriented Stack

If you want the slimmer production layout, use `docker-compose.prod.yml`.

That file starts:

- PostgreSQL
- Redis
- MinIO
- the backend container
- Nginx as the reverse proxy

This path is closer to a deployable server setup, but it expects the backend image and environment file to be configured correctly.

## Key Ports

| Service | Port |
| --- | --- |
| FastAPI backend | 8000 |
| PostgreSQL | 5435 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |
| LiveKit HTTP | 7880 |
| LiveKit WebRTC TCP | 7881 |
| LiveKit WebRTC UDP | 7882 |
| LiveKit TURN UDP | 3478 |
| LiveKit TURN TLS | 5349 |
| Judge0 | 2358 |
| Vite dev server | 5173 |

## Configuration Defaults

The backend has sensible local defaults, but you can override them with a `.env` file if needed.

Important values to know:

- `DATABASE_URL` should point to PostgreSQL
- `LIVEKIT_URL` defaults to `ws://127.0.0.1:7880`
- `LIVEKIT_API_KEY` defaults to `devkey`
- `JUDGE0_URL` defaults to `http://localhost:2358`
- `JWT_SECRET` has a development default and should be changed for production

If you create a `backend/.env`, keep it out of source control.

## Typical First Run Checklist

1. Docker Desktop is running.
2. `docker compose up -d` finishes without errors.
3. PostgreSQL responds on `localhost:5435`.
4. Redis responds on `localhost:6379`.
5. MinIO responds on ports `9000` and `9001`.
6. Judge0 responds on `localhost:2358`.
7. The backend starts on port `8000`.
8. The client can reach the backend API.

## Troubleshooting

### LiveKit Egress keeps restarting

Make sure `egress.yaml` contains `redis.address: redis:6379`. Without that Redis address, LiveKit Egress can fail during startup.

### Backend cannot connect to PostgreSQL

Check that Docker is running and that the backend is using the mapped host port `5435`.

### Tauri or Rust build failures on Windows

Install the Visual C++ Build Tools and WebView2 Runtime, then verify `rustc --version` and `cargo --version` work in a new terminal.

### Vite fails because `cert.key` or `cert.crt` is missing

Generate the files in `client/` with `mkcert`, then restart the dev server.

### Judge0 requests fail

Confirm the Judge0 container is healthy and listening on `localhost:2358`.

## Notes

- The root `package.json` exists in this repository, but the actively wired React/Tauri client is under `client/`.
- The backend and client are split, so you generally run them separately during development.
- The Docker Compose file in the repository root is the fastest way to start the infrastructure for local testing.

## Suggested Startup Order

1. Install the prerequisites listed above.
2. Start the infrastructure with `docker compose up -d`.
3. Run the FastAPI backend.
4. Run the client in `client/`.
5. Open the app and verify health endpoints and log output.
