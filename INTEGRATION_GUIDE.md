# Route Integration Guide

## Overview
The system now uses **RouteDefinitions** as the single source of truth, with **RouteShapes** automatically generated for backward compatibility with existing mini-map systems.

## Benefits
- ✅ **Single source of truth**: Update waypoints in one place
- ✅ **Automatic synchronization**: RouteShapes updates when RouteDefinitions change
- ✅ **Backward compatibility**: Existing mini-map code continues to work
- ✅ **Type safety**: Full TypeScript support throughout

## Usage Examples

### Adding a New Route
```typescript
// 1. Add to RouteDefinitions only (RouteShapes updates automatically)
RouteDefinitions.R030 = {
    routeNumber: "R030",
    displayName: "New Route",
    operator: "Connect",
    worldWaypoints: [
        new Vector3(0, 0.5, 0),
        new Vector3(100, 0.5, 0),
        new Vector3(200, 0.5, 0),
    ],
    uiWaypoints: [
        new Vector2(0.3, 0.5),
        new Vector2(0.5, 0.5), 
        new Vector2(0.7, 0.5),
    ],
    // ... other properties
};

// 2. RouteShapes.R030 is automatically available
// 3. Mini-map system can access via RouteShapes.R030
```

### Updating Waypoints
```typescript
// Update waypoints using the helper function
RouteManager.updateRouteWaypoints("R001", 
    [
        new Vector3(0, 0.5, 0),
        new Vector3(150, 0.5, 0),    // Changed from 100
        new Vector3(300, 0.5, 0),    // Changed from 200
    ],
    [
        new Vector2(0.3, 0.5),
        new Vector2(0.6, 0.5),       // Updated UI position
        new Vector2(0.8, 0.5),       // Updated UI position
    ]
);

// RouteShapes automatically reflects the changes
```

### Validation
```typescript
// Validate route consistency
if (!RouteManager.validateRoute("R001")) {
    warn("Route R001 has configuration issues!");
}
```

## Integration Points

### Train Movement System
- Uses `RouteDefinitions.R001.worldWaypoints` directly
- Automatic depot path and station handling
- Full SCR-style timing support

### Mini-Map System  
- Uses `RouteShapes.R001.worldWaypoints` (auto-generated)
- Uses `RouteShapes.R001.stationIndices` for station tracking
- Backward compatible with existing code

### Station Names
Station names are automatically cleaned for RouteShapes compatibility:
- "Stepford Central" → "StepfordCentral" 
- "Airport Central" → "AirportCentral"

## Migration Strategy
1. **No changes needed** for existing mini-map code
2. **New features** should use RouteDefinitions directly
3. **Waypoint updates** should use `RouteManager.updateRouteWaypoints()`
4. **Always validate** routes after modifications

## File Structure
```
src/shared/
├── RouteDefinitions.ts    # Primary route data (edit here)
├── RouteShapes.ts         # Auto-generated compatibility layer
└── other modules...
```