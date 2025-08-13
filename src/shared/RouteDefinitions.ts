// RouteDefinitions.ts - SCR-style multi-route system
export interface StationStop {
	name: string;
	waypointIndex: number;
	dwellTime: number; // seconds to stop
	isTerminus?: boolean;
}

export interface DirectionalTiming {
	forward: number; // minutes in forward direction
	reverse: number; // minutes in reverse direction
}

export interface RouteDefinition {
	routeNumber: string; // "R001", "R029", etc
	displayName: string; // "Stepford Central <> Airport Central"
	operator: "Connect" | "Metro" | "Waterline" | "AirLink" | "Express" | "Training";

	// Line grouping - multiple routes can share the same physical line
	lineId: string; // "T1", "Central", "District", etc
	lineColor?: Color3; // Override color for this line

	// Path definition
	worldWaypoints: Vector3[];
	uiWaypoints: Vector2[];
	depotPath: Vector3[]; // Path from depot to first station
	depotSpawn: Vector3; // Spawn point at depot
	mergePoint: number; // Where depot joins main route

	// Service pattern
	stations: StationStop[];
	serviceType: "Local" | "Express" | "Non-Stop" | "Circular";
	allowReverse: boolean;

	// Directional timing (SCR-style asymmetric times)
	journeyTime: DirectionalTiming; // Different times each direction
	segmentTimes?: {
		forward: { [segmentIndex: number]: number }; // seconds per segment forward
		reverse: { [segmentIndex: number]: number }; // seconds per segment reverse
	};

	// Operational parameters
	maxSpeed: number; // studs/second
	pointsPerMinute: number;
	allowedTrainClasses?: string[]; // ["Class68", "Class444"] for restrictions

	// Schedule and timing
	baseFrequency: number; // minutes between trains
	peakFrequency?: number; // rush hour frequency
	operatingHours: { start: number; end: number }; // 24h format
}

export const RouteDefinitions: { [routeId: string]: RouteDefinition } = {
	R001: {
		routeNumber: "R001",
		displayName: "Stepford Central <> Airport Central",
		operator: "Connect",
		lineId: "T1",
		lineColor: new Color3(0, 0.5, 1), // Blue line
		worldWaypoints: [
			new Vector3(0, 0.5, 0), // Stepford Central
			new Vector3(100, 0.5, 0), // Intermediate waypoint
			new Vector3(200, 0.5, 0), // Airport Central
		],
		uiWaypoints: [new Vector2(0.3, 0.5), new Vector2(0.5, 0.5), new Vector2(0.7, 0.5)],
		depotPath: [
			new Vector3(-50, 0.5, -20), // Depot exit
			new Vector3(-25, 0.5, -10), // Junction approach
			new Vector3(0, 0.5, 0), // Merge with main line
		],
		depotSpawn: new Vector3(-50, 0.5, -25),
		mergePoint: 0,
		stations: [
			{ name: "Stepford Central", waypointIndex: 0, dwellTime: 1 },
			{ name: "Airport Central", waypointIndex: 2, dwellTime: 1, isTerminus: true },
		],
		serviceType: "Express",
		allowReverse: true,
		journeyTime: { forward: 18, reverse: 18 }, // Same time both directions
		segmentTimes: {
			forward: { 0: 10, 1: 8 }, // 10s + 8s segments
			reverse: { 0: 8, 1: 10 }, // Reverse timing
		},
		maxSpeed: 40,
		pointsPerMinute: 12,
		baseFrequency: 10,
		peakFrequency: 5,
		operatingHours: { start: 5, end: 24 },
	},

	R029: {
		routeNumber: "R029",
		displayName: "Stepford Victoria <> Beechley",
		operator: "Metro",
		lineId: "Metro1",
		lineColor: new Color3(1, 0, 0), // Red line
		worldWaypoints: [
			new Vector3(-100, 0.5, 100), // Stepford Victoria
			new Vector3(-50, 0.5, 150), // Beechley
		],
		uiWaypoints: [new Vector2(0.2, 0.7), new Vector2(0.4, 0.8)],
		depotPath: [
			new Vector3(-120, 0.5, 80), // Metro depot
			new Vector3(-100, 0.5, 100), // Victoria
		],
		depotSpawn: new Vector3(-125, 0.5, 75),
		mergePoint: 0,
		stations: [
			{ name: "Stepford Victoria", waypointIndex: 0, dwellTime: 20 },
			{ name: "Beechley", waypointIndex: 1, dwellTime: 20, isTerminus: true },
		],
		serviceType: "Local",
		allowReverse: true,
		journeyTime: { forward: 4, reverse: 4 }, // Metro routes usually same time
		segmentTimes: {
			forward: { 0: 4 }, // 4 seconds per segment (fast metro)
			reverse: { 0: 4 }, // Same reverse
		},
		maxSpeed: 25,
		pointsPerMinute: 18, // Highest points per minute
		baseFrequency: 3,
		operatingHours: { start: 6, end: 23 },
	},

	// SCR-style asymmetric route example
	R026: {
		routeNumber: "R026",
		displayName: "Stepford Victoria <> Llyn-by-the-Sea",
		operator: "Connect",
		lineId: "ConnectWest", // Different line - different track!
		lineColor: new Color3(0, 0.8, 0), // Green line
		worldWaypoints: [
			new Vector3(-100, 0.5, 100), // Stepford Victoria
			new Vector3(-150, 0.5, 200), // Intermediate
			new Vector3(-200, 0.5, 300), // More stations...
			new Vector3(-300, 0.5, 500), // Llyn-by-the-Sea
		],
		uiWaypoints: [new Vector2(0.25, 0.6), new Vector2(0.15, 0.7), new Vector2(0.1, 0.8), new Vector2(0.05, 0.9)],
		depotPath: [new Vector3(-120, 0.5, 80), new Vector3(-100, 0.5, 100)],
		depotSpawn: new Vector3(-125, 0.5, 75),
		mergePoint: 0,
		stations: [
			{ name: "Stepford Victoria", waypointIndex: 0, dwellTime: 30 },
			{ name: "Llyn-by-the-Sea", waypointIndex: 3, dwellTime: 30, isTerminus: true },
		],
		serviceType: "Express",
		allowReverse: true,
		allowedTrainClasses: ["Class68", "Class444"], // SCR restriction
		journeyTime: { forward: 34, reverse: 42 }, // SCR asymmetric timing!
		segmentTimes: {
			forward: { 0: 10, 1: 12, 2: 12 }, // Fast route - seconds per segment
			reverse: { 0: 14, 1: 14, 2: 14 }, // Slower reverse (SCR style)
		},
		maxSpeed: 50,
		pointsPerMinute: 15,
		baseFrequency: 20,
		operatingHours: { start: 6, end: 22 },
	},

	// Example: Another route on T1 line (Express service)
	R001X: {
		routeNumber: "R001X",
		displayName: "Stepford Central <> Airport Central (Express)",
		operator: "Connect",
		lineId: "T1", // Same T1 line as R001 - ACTUALLY shares the track
		lineColor: new Color3(0, 0.5, 1), // Same blue line
		worldWaypoints: [
			new Vector3(0, 0.5, 0), // Stepford Central
			new Vector3(100, 0.5, 0), // Skips intermediate - express!
			new Vector3(200, 0.5, 0), // Airport Central
		],
		uiWaypoints: [new Vector2(0.3, 0.5), new Vector2(0.5, 0.5), new Vector2(0.7, 0.5)],
		depotPath: [new Vector3(-50, 0.5, -20), new Vector3(-25, 0.5, -10), new Vector3(0, 0.5, 0)],
		depotSpawn: new Vector3(-50, 0.5, -25),
		mergePoint: 0,
		stations: [
			{ name: "Stepford Central", waypointIndex: 0, dwellTime: 20 }, // Shorter dwell - express
			{ name: "Airport Central", waypointIndex: 2, dwellTime: 20, isTerminus: true },
		],
		serviceType: "Express",
		allowReverse: true,
		journeyTime: { forward: 12, reverse: 12 }, // Faster than regular R001
		segmentTimes: {
			forward: { 0: 8, 1: 6 }, // Faster segments
			reverse: { 0: 6, 1: 8 },
		},
		maxSpeed: 50, // Faster than regular
		pointsPerMinute: 15,
		baseFrequency: 15, // Less frequent - express service
		operatingHours: { start: 7, end: 22 }, // Peak hours only
	},
};

// Route selection and management
export class RouteManager {
	static getAvailableRoutes(operator?: string): RouteDefinition[] {
		const routes: RouteDefinition[] = [];
		for (const [, route] of pairs(RouteDefinitions)) {
			routes.push(route);
		}
		// eslint-disable-next-line roblox-ts/lua-truthiness
		return operator ? routes.filter((r: RouteDefinition) => r.operator === operator) : routes;
	}

	static getRoute(routeId: string): RouteDefinition | undefined {
		return RouteDefinitions[routeId];
	}

	static isOperational(routeId: string, currentHour: number): boolean {
		const route = RouteDefinitions[routeId];
		if (!route) return false;
		return currentHour >= route.operatingHours.start && currentHour <= route.operatingHours.end;
	}

	static getFrequency(routeId: string, isPeakHour: boolean): number {
		const route = RouteDefinitions[routeId];
		if (!route) return 10;
		return isPeakHour && route.peakFrequency ? route.peakFrequency : route.baseFrequency;
	}

	// Helper function to update waypoints across the entire system
	static updateRouteWaypoints(routeId: string, worldWaypoints: Vector3[], uiWaypoints: Vector2[]): boolean {
		const route = RouteDefinitions[routeId];
		if (!route) return false;

		route.worldWaypoints = worldWaypoints;
		route.uiWaypoints = uiWaypoints;

		print(
			`Updated waypoints for route ${routeId} - ${worldWaypoints.size()} world waypoints, ${uiWaypoints.size()} UI waypoints`,
		);
		return true;
	}

	// Helper to validate route consistency
	static validateRoute(routeId: string): boolean {
		const route = RouteDefinitions[routeId];
		if (!route) return false;

		// Check waypoint consistency
		if (route.worldWaypoints.size() !== route.uiWaypoints.size()) {
			warn(
				`Route ${routeId}: Mismatch between world (${route.worldWaypoints.size()}) and UI (${route.uiWaypoints.size()}) waypoints`,
			);
			return false;
		}

		// Check station waypoint indices are valid
		for (const station of route.stations) {
			if (station.waypointIndex >= route.worldWaypoints.size()) {
				warn(
					`Route ${routeId}: Station "${station.name}" has invalid waypoint index ${station.waypointIndex} (max: ${route.worldWaypoints.size() - 1})`,
				);
				return false;
			}
		}

		return true;
	}
}
