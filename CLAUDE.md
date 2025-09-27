# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

scaff-web is a Next.js-based multi-view building editor that provides synchronized plan, elevation, and 3D views for architectural design. The application focuses on scaffolding/construction design with support for multi-floor structures.

## Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Linting
npm run lint

# Run tests (Jest with React Testing Library)
npm test

# Run specific test file
npm test -- src/components/__tests__/editorViews.test.tsx
```

## Architecture

### Core Technologies
- **Framework**: Next.js 15 with TypeScript, React 18
- **3D Rendering**: Three.js with @react-three/fiber and @react-three/drei
- **2D Canvas**: React Konva (Konva.js wrapper)
- **Styling**: Tailwind CSS
- **Testing**: Jest with React Testing Library

### State Management Architecture

The application uses Context API with a reducer pattern centered around `BuildingProvider`:

1. **BuildingModel** - Core data structure containing:
   - Multiple floor models with polygon vertices, dimensions, and roof configurations
   - Template system (rectangle, L-shape, T-shape, U-shape)
   - Active floor tracking and validation state

2. **BuildingReducer** - Handles all state mutations with:
   - Polygon self-intersection validation
   - Edge length recalculation on vertex updates
   - Floor duplication/removal with automatic style generation
   - Persistent storage via localStorage

3. **View Synchronization** - All views consume the same BuildingContext:
   - PlanViewCanvas: 2D top-down editor with vertex manipulation
   - ElevationViews: Front/left/right/back orthogonal projections
   - ThreeDView: Interactive 3D visualization
   - Changes in any view immediately reflect in all others

### Key Design Patterns

- **Immutable Updates**: All state changes create new objects, never mutate existing ones
- **Validation-First**: Polygon operations check for self-intersection before applying
- **Edge-Based Dimensions**: Dimensions are tied to polygon edges, auto-recalculating on vertex changes
- **Floor Stacking**: Multi-floor support with independent polygons but shared template origins

### Project Intent

The application is designed for the construction/scaffolding industry in Japan, with Japanese UI text and dimension units in millimeters. The UI/UX improvement request in `.sdd/description.md` indicates a need for:
- Full-screen editor workspace
- Collapsible sidebar for non-drawing tools
- Modern, polished UI suitable for construction professionals
- Import/export/delete operations in a header toolbar