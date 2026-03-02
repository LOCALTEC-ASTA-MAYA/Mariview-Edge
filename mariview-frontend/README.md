# Mariview Project Documentation

This is the comprehensive documentation for the Mariview Project. It combines all individual guides, plans, and setup instructions into one complete file.

## 📋 Table of Contents
1. [General Information](#1-general-information)
2. [Running Locally](#2-running-locally)
3. [Server Setup & Deployment](#3-server-setup--deployment)
4. [Docker Build Instructions](#4-docker-build-instructions)
5. [Data Storage Guide](#5-data-storage-guide)
6. [Data Fetching & Sync](#6-data-fetching--sync)
7. [API Integration (GraphQL)](#7-api-integration-graphql)
8. [Backend Integration Plan](#8-backend-integration-plan)
9. [iPad Responsiveness](#9-ipad-responsiveness)
10. [Attributions](#10-attributions)

---

## 1. General Information
This is a code bundle for KKP-MariviewUpdate Flow. The original project is available at [Figma](https://www.figma.com/design/gdOs9HKcgjm0ARSyFQqMsn/KKP-MariviewUpdate-Flow).

---

## 2. Running Locally
- Run `npm i` to install the dependencies.
- Run `npm run dev` to start the development server.

---

## 3. Server Setup & Deployment
This section explains how to set up the Mariview UI on a fresh server.

### Automatic Installation (Recommended)
Run the included `install.sh` script to automatically install Node.js (v20) and project dependencies.
```bash
chmod +x install.sh
./install.sh
```

### Manual Installation
1. **Node.js**: Ensure v20.x or higher is installed.
2. **NPM**: Comes with Node.js.
3. **Install Dependencies**: `npm install`
4. **Build for Production**: `npm run build`

### Deployment Options
- **Nginx**: Serve the `dist` folder content.
- **Docker**: Run `docker-compose up -d --build`.

---

## 4. Docker Build Instructions
To build only the frontend service using Docker Compose:
```bash
docker-compose build frontend
```

To build and start immediately:
```bash
docker-compose up -d --build frontend
```

---

## 5. Data Storage Guide
The system stores changes automatically in the browser's **localStorage**.

### Saved Data:
- Missions, Drones, Vehicles, Accessories, Flights, Settings.

### Backup & Restore:
- **Export**: Settings → Data → Export (JSON).
- **Import**: Settings → Data → Import.
- **Clear**: Settings → Data → Clear All.

---

## 6. Data Fetching & Sync
The application uses a hybrid approach for data:
- **GraphQL**: Primary data source for Missions and Live Telemetry using `@apollo/client`.
- **Mock Data**: Fallback/initial data located in `/data/mock-data.ts`.
- **localStorage**: Persistent storage for local settings and offline missions.

---

## 7. API Integration (GraphQL)
The system is integrated with a GraphQL API. Queries are centralized in `src/graphql/queries.ts`.

### How to use:
1. **Configure Client**: Set your API endpoint in `src/lib/apollo-client.ts`.
2. **Fetch Data**: Use the `useQuery` hook in components (see `MissionHistory.tsx` or `LiveOperationsNew.tsx`).

---

## 8. Backend Integration Plan
The transition to a full backend is in progress. 
- **Phase 1 (Completed)**: GraphQL client integration and basic schema implementation.
- **Phase 2 (Next)**: WebSocket for real-time telemetry (currently using GraphQL polling).
- **Phase 3 (Next)**: Deep PostgreSQL integration for video management.

---

## 9. iPad Responsiveness
The UI is optimized for tablet devices (iPad Pro/Air).
- **Breakpoints**: Uses Tailwind `md:` (768px) and `lg:` (1024px) for layout shifts.
- **Sidebar**: Automatically collapses or shrinks on smaller screens.
- **Telemetry Grid**: Adapts from 12 columns to 6 or 8 columns on tablets to prevent overlapping.

---

## 10. Attributions
- **shadcn/ui**: Components used under MIT license.
- **Unsplash**: Photos used under Unsplash license.