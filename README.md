# One Journey — Ahmedabad & Gandhinagar React prototype

A responsive React + Vite prototype for a unified journey planner concept across Metro, AMTS, BRTS and GTSL.

## Requirements

- Node.js 20.12.2 or later in the Node 20 line
- npm

The project pins Vite to 6.4.1 and uses the Rollup-based Vite toolchain rather than the newer Rolldown-based latest release, to avoid the native-binding installation error reported on macOS ARM64.

## Run locally

1. Extract the ZIP and open Terminal in the `one-journey-react` folder.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the local address printed by Vite (typically `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

## Prototype notes

- Routing is based on the included demonstration data and is not a live transit feed.
- Real-time vehicle positions, verified live schedules/fares, and production-grade time-dependent routing are not included.
- Browser location access requires permission.

### Offline dataset loading
The transit dataset is imported from `src/data/journey_demo_data.json` so the application does not depend on a runtime `/data/...` URL. This makes the offline dataset work reliably with Vite dev server and production builds, including deployments under a non-root base path.

