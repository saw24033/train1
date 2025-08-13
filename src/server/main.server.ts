import { makeHello } from "shared/module";
import { debugRouteShapes } from "shared/RouteShapes";

print(makeHello("main.server.ts"));
print("Train server initialized");

// Debug: Show all available routes
debugRouteShapes();

// Import the RouteSpawner system (TrainSystem disabled to avoid conflicts)
import "./RouteSpawner";
