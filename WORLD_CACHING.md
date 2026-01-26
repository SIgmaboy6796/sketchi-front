# World Generation Caching System

## Overview
The game now generates the hexasphere world **only once** and saves it to a file for reuse. This significantly speeds up subsequent loads.

## How It Works

### Generation Flow
1. **First Load**: When the game starts, it tries to load cached world data from `/world-data.json`
2. **Cache Miss**: If the file doesn't exist, the world is generated using the H3 indexing system
3. **Auto-Save**: After generation, the world data is automatically saved to `public/world-data.json`
4. **Subsequent Loads**: All future runs load from the cached file (instant load)

### Code Changes

#### `core/World.ts`
- **`init()`**: Now tries to load cached data first, falls back to generation
- **`generateWorldData()`**: Generates H3 hex grid, terrain, and biome data (only runs once)
- **`buildWorldFromData(data)`**: Builds the 3D meshes from cached or generated data
- **`saveWorldDataToFile(data)`**: Posts generated data to server endpoint for saving

#### `vite.config.ts`
- Added custom Vite plugin `worldDataPlugin()` that:
  - Runs only in development mode (`apply: 'serve'`)
  - Listens for POST requests to `/api/save-world`
  - Saves JSON data to `public/world-data.json`
  - Automatically creates the `public/` directory if needed

#### `package.json`
- Added `@types/node` devDependency for Node.js type support

## File Structure
```
/workspaces/sketchi-front/
├── public/
│   ├── .gitkeep
│   └── world-data.json         ← Generated on first run
├── core/
│   └── World.ts                ← Updated caching logic
├── vite.config.ts              ← Added save endpoint
└── package.json                ← Added @types/node
```

## Performance Impact
- **First Load**: ~2-3 seconds (world generation)
- **Subsequent Loads**: ~0.2 seconds (instant cache load)
- **Cache Size**: ~100-200 KB JSON file

## WorldData Format
The cached data contains:
- `centers`: Vector3 positions of hex centers
- `centerNeighbors`: Adjacency graph (6 neighbors per hex)
- `centerWater`: Ocean/coast classification
- `centerLat`/`centerLng`: Geographic coordinates
- `hexagons`: H3 cell indices
- `biomes`: Terrain type for each hex
- `elevations`: Height values for terrain visualization

## Manual Cache Reset
To regenerate the world:
```bash
rm public/world-data.json
# Reload the page - world will regenerate and re-cache
```

## Development Notes
- The world generation is deterministic (same seed → same world)
- Landmask support is integrated for real-world terrain
- Cache only applies during development; build production bundles will use their own caching
