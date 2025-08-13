// RouteShapes.ts - Integrated route data module
import { RouteDefinitions, RouteDefinition } from "./RouteDefinitions";

export interface RouteShapesType {
	[routeKey: string]: {
		worldWaypoints: Vector3[];
		uiWaypoints: Vector2[];
		allowReverse: boolean;
		stationIndices: { [station: string]: number };
	};
}

// Legacy route data (preserved from original system)
const legacyRoutes: RouteShapesType = {
	Main: {
		worldWaypoints: [
			new Vector3(196.7, 0.5, 270.8), // curve node
			new Vector3(-18.192, 0.5, -86.013), // curve node
			new Vector3(-293, 0.5, -86.909), // Station A
			new Vector3(-565.855, 0.5, -86.909),
		],
		uiWaypoints: [
			new Vector2(0.161, 0.8),
			new Vector2(0.161, 0.6),
			new Vector2(0.161, 0.4),
			new Vector2(0.161, 0.2),
		],
		allowReverse: false,
		stationIndices: {
			StationA: 2, // 0-indexed in TypeScript (was 3 in 1-indexed Lua)
		},
	},
};

// Convert RouteDefinitions to RouteShapes format (individual routes)
function generateSCRRouteShapes(): RouteShapesType {
	const shapes: RouteShapesType = {};

	// Create individual shapes for each route
	for (const [routeId, route] of pairs(RouteDefinitions)) {
		const routeKey = tostring(routeId);

		// Build station indices map
		const stationIndices: { [station: string]: number } = {};
		for (let i = 0; i < route.stations.size(); i++) {
			const station = route.stations[i];
			// Remove spaces from station name for compatibility
			const cleanName = string.gsub(station.name, "%s+", "")[0];
			stationIndices[cleanName] = station.waypointIndex;
		}

		shapes[routeKey] = {
			worldWaypoints: route.worldWaypoints,
			uiWaypoints: route.uiWaypoints,
			allowReverse: route.allowReverse,
			stationIndices: stationIndices,
		};
	}

	return shapes;
}

// Merge legacy routes with SCR routes
function createIntegratedRouteShapes(): RouteShapesType {
	const scrRoutes = generateSCRRouteShapes();
	const integrated: RouteShapesType = {};

	// Add legacy routes first
	for (const [routeKey, routeData] of pairs(legacyRoutes)) {
		integrated[routeKey] = routeData;
	}

	// Add SCR routes (will override if same key exists)
	for (const [routeKey, routeData] of pairs(scrRoutes)) {
		integrated[routeKey] = routeData;
	}

	// Keep legacy Main route separate from SCR routes
	if (!integrated.Main) {
		integrated.Main = legacyRoutes.Main;
	}

	return integrated;
}

// Generate RouteShapes from both legacy and SCR definitions
export const RouteShapes: RouteShapesType = createIntegratedRouteShapes();

// Debug function to list all available routes
export function debugRouteShapes(): void {
	print("=== RouteShapes Debug Info ===");
	for (const [routeKey, routeData] of pairs(RouteShapes)) {
		print(`Route: ${routeKey}`);
		print(`  - Waypoints: ${routeData.worldWaypoints.size()}`);
		print(`  - UI Points: ${routeData.uiWaypoints.size()}`);
		print(`  - Allow Reverse: ${routeData.allowReverse}`);
		let stationCount = 0;
		for (const [stationName, waypoint] of pairs(routeData.stationIndices)) {
			stationCount++;
		}
		print(`  - Stations: ${stationCount}`);
		for (const [stationName, waypoint] of pairs(routeData.stationIndices)) {
			print(`    - ${stationName}: waypoint ${waypoint}`);
		}
	}
	print("=== End RouteShapes Debug ===");
}

export default RouteShapes;
