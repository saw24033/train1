// RouteSpawner.server.ts - SCR-style train spawning and route management
import { RunService, ReplicatedStorage, Workspace, Players } from "@rbxts/services";
import { RouteDefinitions, RouteManager, RouteDefinition } from "shared/RouteDefinitions";
import { createRemoteEvents, REMOTE_EVENT_NAMES } from "shared/RemoteEvents";

// Get the MapEvent for broadcasting AI train positions
const remoteEvents = createRemoteEvents();
const MapEvent = remoteEvents[REMOTE_EVENT_NAMES.MAP_UPDATE];

// Train state for route-based operation
interface RouteTrainState {
	trainName: string;
	routeId: string;
	currentPhase: "depot" | "service" | "returning";
	waypointIndex: number;
	t: number; // position along current segment
	direction: "forward" | "reverse";
	nextStationIndex: number;
	dwellStartTime?: number;
}

const activeTrains = new Map<string, RouteTrainState>();
const routeSchedules = new Map<string, number>(); // Last spawn time per route

// Create RouteSelection RemoteEvent
let RouteSelectionEvent = ReplicatedStorage.FindFirstChild("RouteSelection") as RemoteEvent;
if (!RouteSelectionEvent) {
	RouteSelectionEvent = new Instance("RemoteEvent");
	RouteSelectionEvent.Name = "RouteSelection";
	RouteSelectionEvent.Parent = ReplicatedStorage;
	print("Created RemoteEvent: RouteSelection");
}

// Handle player route selection
RouteSelectionEvent.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
	const routeId = args[0] as string;
	const route = RouteManager.getRoute(routeId);
	if (!route) {
		warn(`Invalid route selected: ${routeId}`);
		return;
	}

	// Check if route is operational
	const currentHour = math.floor(tick() / 3600) % 24;
	if (!RouteManager.isOperational(routeId, currentHour)) {
		// Send error to player - route not operational
		return;
	}

	spawnTrainForRoute(routeId, player.Name);
});

function spawnTrainForRoute(routeId: string, playerName?: string): void {
	const route = RouteManager.getRoute(routeId);
	if (!route) return;

	// eslint-disable-next-line roblox-ts/lua-truthiness
	const trainName = playerName ? `${playerName}_${routeId}` : `AI_${routeId}_${tick()}`;

	// Create train model at depot
	const trainsFolder = (Workspace.FindFirstChild("Trains") as Folder) || new Instance("Folder");
	trainsFolder.Name = "Trains";
	trainsFolder.Parent = Workspace;

	const trainModel = new Instance("Model");
	trainModel.Name = trainName;
	trainModel.Parent = trainsFolder;

	// Create train part at depot spawn point
	const trainPart = new Instance("Part");
	trainPart.Name = "Primary";
	trainPart.Size = new Vector3(4, 2, 16);
	trainPart.Position = route.depotSpawn;
	trainPart.Material = Enum.Material.Metal;
	trainPart.BrickColor = getOperatorColor(route.operator);
	trainPart.Anchored = true;
	trainPart.Parent = trainModel;
	trainModel.PrimaryPart = trainPart;

	// Add route identification
	const routeGui = new Instance("BillboardGui");
	routeGui.Size = UDim2.fromOffset(200, 50);
	routeGui.Parent = trainPart;

	const routeLabel = new Instance("TextLabel");
	routeLabel.Size = UDim2.fromScale(1, 1);
	routeLabel.BackgroundTransparency = 1;
	routeLabel.Text = `${route.routeNumber}: ${route.displayName}`;
	routeLabel.TextColor3 = new Color3(1, 1, 1);
	routeLabel.TextScaled = true;
	routeLabel.Font = Enum.Font.GothamBold;
	routeLabel.Parent = routeGui;

	// Initialize train state
	const trainState: RouteTrainState = {
		trainName,
		routeId,
		currentPhase: "depot",
		waypointIndex: 0,
		t: 0,
		direction: "forward",
		nextStationIndex: 0,
	};

	activeTrains.set(trainName, trainState);
	print(`Spawned train ${trainName} for route ${routeId} at depot`);
}

function getOperatorColor(operator: string): BrickColor {
	const colors = {
		Connect: new BrickColor("Bright blue"),
		Metro: new BrickColor("Medium stone grey"),
		Waterline: new BrickColor("Bright blue"),
		AirLink: new BrickColor("Bright yellow"),
		Express: new BrickColor("Bright green"),
		Training: new BrickColor("Bright orange"),
	};
	return colors[operator as keyof typeof colors] || new BrickColor("Medium stone grey");
}

// Automatic train spawning based on frequency
function autoSpawnTrains(): void {
	const currentTime = tick();
	const currentHour = math.floor(currentTime / 3600) % 24;
	const isPeakHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19);

	for (const [routeId] of pairs(RouteDefinitions)) {
		const routeIdStr = tostring(routeId);
		if (!RouteManager.isOperational(routeIdStr, currentHour)) continue;

		// eslint-disable-next-line roblox-ts/lua-truthiness
		const lastSpawn = routeSchedules.get(routeIdStr) || 0;
		const frequency = RouteManager.getFrequency(routeIdStr, isPeakHour);
		const spawnInterval = frequency * 60; // Convert minutes to seconds

		if (currentTime - lastSpawn >= spawnInterval) {
			spawnTrainForRoute(routeIdStr);
			routeSchedules.set(routeIdStr, currentTime);
		}
	}
}

// Helper function to validate and clamp waypoint index
function validateWaypointIndex(state: RouteTrainState, waypoints: Vector3[], phase: string): boolean {
	const maxIndex = waypoints.size() - 1;

	if (state.waypointIndex < 0 || state.waypointIndex > maxIndex) {
		warn(
			`CRITICAL: Train ${state.trainName} has invalid waypointIndex: ${state.waypointIndex} (max: ${maxIndex}) in phase: ${phase}`,
		);

		// Clamp to valid range
		const oldIndex = state.waypointIndex;
		state.waypointIndex = math.clamp(state.waypointIndex, 0, maxIndex);

		print(`Fixed waypointIndex for train ${state.trainName}: ${oldIndex} -> ${state.waypointIndex}`);
		return false; // Indicates we had to fix it
	}

	return true; // Index was valid
}

// Main update loop for route-based train movement
RunService.Heartbeat.Connect((deltaTime: number) => {
	// Auto-spawn trains based on schedule
	autoSpawnTrains();

	// Update all active trains
	for (const [trainName, state] of pairs(activeTrains)) {
		updateTrainOnRoute(trainName, state, deltaTime);
	}
});

function updateTrainOnRoute(trainName: string, state: RouteTrainState, deltaTime: number): void {
	const train = Workspace.FindFirstChild("Trains")?.FindFirstChild(trainName) as Model;
	if (!train || !train.PrimaryPart) {
		activeTrains.delete(trainName);
		return;
	}

	const route = RouteManager.getRoute(state.routeId);
	if (!route) return;

	const part = train.PrimaryPart;

	// Determine current waypoint path based on phase
	let waypoints: Vector3[];
	let maxIndex: number;

	if (state.currentPhase === "depot") {
		waypoints = route.depotPath;
		maxIndex = waypoints.size() - 1;
	} else {
		waypoints = route.worldWaypoints;
		maxIndex = waypoints.size() - 1;
	}

	// Validate waypoint index before proceeding
	if (!validateWaypointIndex(state, waypoints, state.currentPhase)) {
		// If we had to fix the index, reset t to prevent interpolation issues
		state.t = 0;
	}

	// Move train along waypoints - handle both forward and reverse
	const canMoveForward = state.direction === "forward" && state.waypointIndex < maxIndex;
	const canMoveReverse = state.direction === "reverse" && state.waypointIndex > 0;

	if (canMoveForward || canMoveReverse) {
		let currentWp: Vector3;
		let nextWp: Vector3;

		if (state.direction === "forward") {
			currentWp = waypoints[state.waypointIndex];
			nextWp = waypoints[state.waypointIndex + 1];
		} else {
			// Reverse direction
			currentWp = waypoints[state.waypointIndex];
			nextWp = waypoints[state.waypointIndex - 1];
		}

		// Validate waypoints before interpolation
		if (!currentWp || !nextWp) {
			warn(
				`CRITICAL: Train ${trainName} has invalid waypoints - current: ${state.waypointIndex}, direction: ${state.direction}, maxIndex: ${maxIndex}`,
			);
			warn(`Current waypoint: ${currentWp}, Next waypoint: ${nextWp}`);
			return;
		}

		// Calculate movement with directional timing
		let segmentTime: number;

		if (state.currentPhase === "depot") {
			// Use default speed for depot movement
			const segmentLength = currentWp.sub(nextWp).Magnitude;
			segmentTime = segmentLength / route.maxSpeed;
		} else {
			// Use directional segment times from route definition
			const segmentTimes = route.segmentTimes;
			const direction = state.direction === "forward" ? "forward" : "reverse";

			if (segmentTimes && segmentTimes[direction] && segmentTimes[direction][state.waypointIndex] !== undefined) {
				segmentTime = segmentTimes[direction][state.waypointIndex];
			} else {
				// Fallback: calculate from journey time
				const totalTime = state.direction === "forward" ? route.journeyTime.forward : route.journeyTime.reverse;
				const numSegments = waypoints.size() - 1;
				segmentTime = (totalTime * 60) / numSegments; // Convert minutes to seconds
			}
		}

		const deltaT = deltaTime / segmentTime;
		state.t += deltaT;

		if (state.t >= 1) {
			state.t = 0;

			// Move waypoint based on direction
			if (state.direction === "forward") {
				state.waypointIndex++;
			} else {
				state.waypointIndex--;
			}

			// Validate waypoint index after movement
			validateWaypointIndex(state, waypoints, state.currentPhase);

			// Check for phase transitions
			if (state.currentPhase === "depot" && state.waypointIndex >= maxIndex) {
				state.currentPhase = "service";
				state.waypointIndex = route.mergePoint;
				state.t = 0;
				print(`Train ${trainName} entered service on route ${state.routeId}`);
			}
		}

		// Interpolate position with final validation
		const newPos = currentWp.Lerp(nextWp, state.t);

		// Validate position before setting
		if (newPos && newPos.X !== undefined && newPos.Y !== undefined && newPos.Z !== undefined) {
			part.Position = newPos;
		} else {
			warn(`CRITICAL: Train ${trainName} generated invalid position: ${newPos}`);
			return;
		}

		// Face movement direction
		const direction = nextWp.sub(currentWp).Unit;
		part.CFrame = new CFrame(newPos, newPos.add(direction));
	} else {
		// Train can't move - handle terminus behavior
		if (state.direction === "forward" && state.waypointIndex >= maxIndex) {
			// Reached forward terminus - reverse if allowed
			if (route.allowReverse) {
				print(`Train ${trainName} reached forward terminus, reversing direction`);
				state.direction = "reverse";
				state.waypointIndex = maxIndex; // Ensure at terminus
				state.t = 0;
				// Find next station in reverse direction
				for (let i = route.stations.size() - 1; i >= 0; i--) {
					if (route.stations[i].waypointIndex < state.waypointIndex) {
						state.nextStationIndex = i;
						break;
					}
				}
			}
		} else if (state.direction === "reverse" && state.waypointIndex <= 0) {
			// Reached reverse terminus (origin) - start new forward journey
			print(`Train ${trainName} completed round trip, starting new journey`);
			state.direction = "forward";
			state.waypointIndex = 0; // Ensure at origin
			state.t = 0;
			state.nextStationIndex = 1; // Look for first station after origin
		}
	}

	// Handle station stops during service phase
	if (state.currentPhase === "service") {
		handleStationLogic(trainName, state, route);
	}

	// Broadcast AI train position to clients (since MapBroadcaster skips AI trains)
	if (state.currentPhase === "service") {
		broadcastAITrainPosition(trainName, state, route, part);
	}
}

function handleStationLogic(trainName: string, state: RouteTrainState, route: RouteDefinition): void {
	const currentStation = route.stations[state.nextStationIndex];
	if (!currentStation) return;

	// Check if at station
	if (state.waypointIndex === currentStation.waypointIndex) {
		// eslint-disable-next-line roblox-ts/lua-truthiness
		if (!state.dwellStartTime) {
			state.dwellStartTime = tick();
			print(`Train ${trainName} arrived at ${currentStation.name}`);
		}

		// Dwell time logic
		const dwellTime = tick() - state.dwellStartTime;
		if (dwellTime >= currentStation.dwellTime) {
			state.dwellStartTime = undefined;
			state.nextStationIndex++;

			// Check for terminus
			if (currentStation.isTerminus && route.allowReverse) {
				const newDirection = state.direction === "forward" ? "reverse" : "forward";
				state.direction = newDirection;

				// Set next station based on direction
				if (newDirection === "reverse") {
					// Going reverse - look for stations in reverse order
					let found = false;
					for (let i = route.stations.size() - 1; i >= 0; i--) {
						if (route.stations[i].waypointIndex < state.waypointIndex) {
							state.nextStationIndex = i;
							found = true;
							break;
						}
					}
					if (!found) state.nextStationIndex = 0; // Fallback to origin
				} else {
					// Going forward - look for next station after current position
					let found = false;
					for (let i = 0; i < route.stations.size(); i++) {
						if (route.stations[i].waypointIndex > state.waypointIndex) {
							state.nextStationIndex = i;
							found = true;
							break;
						}
					}
					if (!found) state.nextStationIndex = route.stations.size() - 1; // Fallback to terminus
				}

				// Validate waypoint index after reversal to prevent teleporting
				const waypoints = route.worldWaypoints;
				const maxIndex = waypoints.size() - 1;

				// Ensure waypoint index is valid for the new direction
				if (newDirection === "reverse" && state.waypointIndex > maxIndex) {
					state.waypointIndex = maxIndex;
					print(`Fixed waypoint index after reverse reversal for train ${trainName}: ${maxIndex}`);
				} else if (newDirection === "forward" && state.waypointIndex < 0) {
					state.waypointIndex = 0;
					print(`Fixed waypoint index after forward reversal for train ${trainName}: 0`);
				}

				print(
					`Train ${trainName} reversed at ${currentStation.name} - now going ${newDirection}, next station: ${route.stations[state.nextStationIndex]?.name}`,
				);
			}
		}
	}
}

// Broadcast AI train position to clients
function broadcastAITrainPosition(
	trainName: string,
	state: RouteTrainState,
	route: RouteDefinition,
	trainPart: BasePart,
): void {
	// Convert RouteTrainState to format expected by MapEvent
	const waypoints = route.worldWaypoints;
	const maxIndex = waypoints.size() - 1;

	// Calculate segment and t similar to MapBroadcaster logic
	// For R026: waypoints 0,1,2,3 -> segments 1,2,3 (maxSegments = 3)
	// When at waypoint 3, we should be on segment 3 with t=1
	let bestSeg: number;
	let bestT = state.t;

	if (state.direction === "forward") {
		bestSeg = state.waypointIndex + 1; // waypoint 0->1 is segment 1
	} else {
		// Reverse: waypoint 3->2 is segment 3, waypoint 2->1 is segment 2, etc.
		bestSeg = state.waypointIndex; // waypoint 3->2 is segment 3
	}

	const maxSegments = waypoints.size() - 1; // For R026: 4 waypoints -> 3 segments
	const EPS = 1e-4;

	// Detect whether we're precisely at either terminus. When reversing at the
	// forward terminus the train's t resets to 0, so we explicitly treat that
	// as still being at the end terminus before any canonicalization occurs.
	const isAtOriginTerminus =
		bestSeg === 1 &&
		((state.direction === "forward" && bestT <= EPS) || (state.direction === "reverse" && bestT >= 1 - EPS));

	const isAtEndTerminus =
		bestSeg >= maxSegments &&
		((state.direction === "forward" && bestT >= 1 - EPS) || (state.direction === "reverse" && bestT <= EPS));

	if (bestT <= EPS && bestSeg > 1 && !isAtOriginTerminus && !isAtEndTerminus) {
		bestSeg = bestSeg - 1;
		bestT = 1.0;
	} else if (bestT >= 1 - EPS) {
		bestT = 1.0;
	}

	// Special handling for terminus positions to prevent backwards teleportation
	if (isAtOriginTerminus) {
		bestSeg = 1;
		bestT = 0.0;
	} else if (isAtEndTerminus) {
		bestSeg = maxSegments;
		bestT = 1.0;
	}

	// Build station ETAs (simplified for AI trains)
	const stationETAs = new Map<string, number>();

	// Determine shapeKey from routeId
	const shapeKey = state.routeId;

	// Debug logging for R026 trains
	if (shapeKey === "R026" && math.floor(tick()) % 2 === 0) {
		print(
			`DEBUG AI R026: ${trainName} - waypointIdx:${state.waypointIndex}, t:${math.floor(state.t * 100) / 100}, direction:${state.direction}, bestSeg:${bestSeg}, bestT:${math.floor(bestT * 100) / 100}`,
		);
	}

	// Broadcast to clients
	MapEvent.FireAllClients(trainName, bestSeg, bestT, stationETAs, trainPart.Position, shapeKey, state.direction);
}

// Cleanup function
export function despawnTrain(trainName: string): void {
	const train = Workspace.FindFirstChild("Trains")?.FindFirstChild(trainName);
	if (train) {
		train.Destroy();
	}
	activeTrains.delete(trainName);
}

print("Route Spawner initialized - SCR-style multi-route system active");
