<h1 align="center">CI-Sight</h1>

<p align="center">
  An intelligent monitoring dashboard for GitHub Actions that provides automated failure analysis and performance insights.
</p>

---

<p align="center">
  <img src="https://github.com/user-attachments/assets/cd0650ed-e5ec-4517-80c2-05fa405031c2" alt="CI-Sight Dashboard Screenshot">
  <img src="https://github.com/user-attachments/assets/83fc2e79-b30f-4d8f-aa1a-478f66f20f34" alt="CI-Sight Build Screenshot">
</p>

## Overview

CI-Sight is an open-source tool designed to address the complexity of debugging and monitoring CI/CD pipelines. It ingests data from GitHub Actions via webhooks and uses a combination of machine learning and LLM-driven analysis to automatically categorize failures, identify trends, and suggest solutions. This turns opaque build logs into structured, actionable intelligence, helping engineering teams reduce downtime and improve pipeline reliability.

## Key Features

-   **Centralized Dashboard:** Monitor build success rates, average durations, and error trends across all connected projects from a single interface.
-   **Real-Time Webhook Integration:** Automatically tracks the status of GitHub Actions workflow runs as they happen.
-   **AI-Powered Failure Analysis:**
    -   **Error Classification:** Automatically categorizes build failures (e.g., `Dependency Error`, `Test Failure`) using a zero-shot classification model.
    -   **Vector Similarity Search:** Uses `pgvector` to find previously encountered errors and their known solutions from an embedded knowledge base.
    -   **LLM-Generated Solutions:** Leverages a local LLM (via Ollama) to suggest actionable solutions for novel or complex errors.
-   **Detailed Build Analysis:** Drill down into individual builds to view full, virtualized logs, AI-generated failure reasons, and direct links to the original GitHub run.
-   **Project-Specific Analytics:** Isolate and analyze build performance, health, and activity for individual repositories.
-   **Secure GitHub Integration:** Uses a standard GitHub OAuth flow for authentication and securely encrypts user tokens at rest.

## Technology Stack

<table>
  <tr>
    <td valign="top"><strong>Frontend</strong></td>
    <td>
      <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" alt="React"/>
      <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
      <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite"/>
      <img src="https://img.shields.io/badge/Mantine-339AF0?logo=mantine&logoColor=white" alt="Mantine UI"/>
      <img src="https://img.shields.io/badge/TanStack_Query-FF4154?logo=tanstack&logoColor=white" alt="TanStack Query"/>
    </td>
  </tr>
  <tr>
    <td valign="top"><strong>Backend</strong></td>
    <td>
      <img src="https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js"/>
      <img src="https://img.shields.io/badge/Express-000000?logo=express&logoColor=white" alt="Express"/>
      <img src="https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white" alt="Prisma"/>
      <img src="https://img.shields.io/badge/BullMQ-D12A28?logo=bullmq&logoColor=white" alt="BullMQ"/>
      <img src="https://img.shields.io/badge/JWT-000000?logo=jsonwebtokens&logoColor=white" alt="JWT"/>
    </td>
  </tr>
  <tr>
    <td valign="top"><strong>Database & Cache</strong></td>
    <td>
      <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL"/>
      <img src="https://img.shields.io/badge/pgvector-2E8555?logo=postgresql&logoColor=white" alt="pgvector"/>
      <img src="https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white" alt="Redis"/>
    </td>
  </tr>
  <tr>
    <td valign="top"><strong>ML / AI</strong></td>
    <td>
      <img src="https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white" alt="Python"/>
      <img src="https://img.shields.io/badge/SentenceTransformers-000000" alt="Sentence Transformers"/>
      <img src="https://img.shields.io/badge/Ollama-000000" alt="Ollama"/>
    </td>
  </tr>
  <tr>
    <td valign="top"><strong>DevOps & Testing</strong></td>
    <td>
      <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker"/>
      <img src="https://img.shields.io/badge/Jest-C21325?logo=jest&logoColor=white" alt="Jest"/>
    </td>
  </tr>
</table>

## Deployment

You can run CI-Sight locally for development or deploy it to a production server using Docker.

### Local Development

These instructions are for setting up a local development environment.

**Prerequisites:**
-   Node.js (v18+), Docker, Python (3.8+), and `ngrok`.

1.  **Clone & Configure:**
    ```bash
    git clone https://github.com/anthonyy232/ci-sight.git
    cd ci-sight
    cp .env.example .env
    ```
    -   Edit `.env` and set `PUBLIC_URL` to your `ngrok` HTTPS URL.
    -   Fill in your GitHub OAuth credentials and generate secure secrets.

2.  **Start Services:**
    ```bash
    docker-compose up -d
    ```

3.  **Set Up ML Environment:**
    ```bash
    python3 -m venv ml/venv
    source ml/venv/bin/activate
    pip install -r ml/requirements.txt
    ```
    -   Ensure `PYTHON_EXECUTABLE=./ml/venv/bin/python` is set in your `.env` file.

4.  **Prepare Database:**
    ```bash
    # Apply schema
    npx prisma migrate dev --schema=./server/prisma/schema.prisma
    # Seed vector embeddings
    python3 ml/scripts/seed_known_errors.py
    ```

5.  **Install Dependencies & Run:**
    ```bash
    npm install
    npm run dev
    ```
    -   The frontend will be available at `http://localhost:5173`.

### Production (Docker)

These instructions guide you through deploying the entire application stack using Docker.

**Prerequisites:**
-   A server with Docker and Docker Compose installed.
-   A domain name pointing to your server's IP address.

1.  **Configure for Production:**
    -   Copy `.env.example` to `.env` on your server.
    -   Set `NODE_ENV=production`.
    -   Set `PUBLIC_URL` and `FRONTEND_URL` to your public domain (e.g., `https://ci-sight.yourdomain.com`).
    -   Generate strong, unique values for all secrets (`SESSION_JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `GITHUB_WEBHOOK_SECRET`).
    -   Update `DATABASE_URL` and `REDIS_URL` if you are using external/managed services.

2.  **Create Production Docker Compose File:**
    Create a `docker-compose.prod.yml` file. This configuration builds the application image from the `Dockerfile` and runs it alongside the required services.

    ```yaml
    # docker-compose.prod.yml
    version: '3.8'
    services:
      app:
        build: .
        restart: always
        ports:
          - "4000:4000"
        depends_on:
          - postgres
          - redis
        env_file:
          - .env

      postgres:
        image: pgvector/pgvector:pg16
        restart: always
        environment:
          POSTGRES_USER: ${POSTGRES_USER:-postgres}
          POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
          POSTGRES_DB: ${POSTGRES_DB:-ci_sight}
        volumes:
          - pgdata:/var/lib/postgresql/data

      redis:
        image: redis:7
        restart: always

    volumes:
      pgdata:
    ```

3.  **Build and Run the Application:**
    ```bash
    docker-compose -f docker-compose.prod.yml up --build -d
    ```

4.  **Apply Database Migrations:**
    Run the production-safe migration command to apply the schema to your database.
    ```bash
    docker-compose -f docker-compose.prod.yml exec app npx prisma migrate deploy --schema=./server/prisma/schema.prisma
    ```

5.  **Post-Setup (Recommended):**
    -   Configure a reverse proxy like Nginx or Caddy in front of the application to handle SSL termination and serve traffic on ports 80/443.
    -   Seed the production database with the known error embeddings:
        ```bash
        docker-compose -f docker-compose.prod.yml exec app python3 ml/scripts/seed_known_errors.py
        ```

## Project Structure

<details>
<summary>Click to expand the directory structure</summary>

```
/
├── client/         # React frontend application (Vite, Mantine)
│   ├── src/
│   │   ├── api/      # API client and data-fetching functions
│   │   ├── components/ # Reusable UI components
│   │   └── features/ # Feature-based modules (dashboard, projects, etc.)
│   └── vite.config.ts # Vite configuration with proxy to the backend
├── server/         # Node.js backend application (Express, Prisma)
│   ├── prisma/     # Prisma schema and migrations
│   └── src/
│       ├── jobs/     # Background job processors (BullMQ)
│       ├── middleware/ # Express middleware (auth, error handling)
│   │   ├── modules/  # Feature-based modules with routes, controllers, services
│       └── services/ # Shared services (GitHub API, crypto, etc.)
├── ml/             # Python scripts for ML tasks
│   ├── scripts/    # Scripts for classification, similarity search, and seeding
│   └── requirements.txt # Python dependencies
├── docker-compose.yml # Defines PostgreSQL & Redis services for development
└── Dockerfile      # Multi-stage Dockerfile for production builds
```

</details>

## License

This project is licensed under the MIT License.
