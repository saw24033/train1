// MapBroadcaster.server.ts - Server-side map matching with per-station ETA broadcasting and arrival resets

import { RunService, ReplicatedStorage, Workspace } from "@rbxts/services";
import { RouteShapes } from "shared/RouteShapes";
import { TripModificationManager, TripModification, TripStatus } from "shared/TripModSimple";
import { MapUtilsSimple } from "shared/MapUtilsSimple";
import { CleanedScheduleSimple } from "shared/CleanedScheduleSimple";
import { KalmanSimple, SimpleKalmanFilter } from "shared/KalmanSimple";
import { createRemoteEvents, REMOTE_EVENT_NAMES } from "shared/RemoteEvents";

// Create all RemoteEvents
const remoteEvents = createRemoteEvents();
const MapEvent = remoteEvents[REMOTE_EVENT_NAMES.MAP_UPDATE];
const ScheduleEvent = remoteEvents[REMOTE_EVENT_NAMES.SCHEDULE_UPDATE];
const ModificationEvent = remoteEvents[REMOTE_EVENT_NAMES.TRIP_MODIFICATION];

// State interfaces
interface TrainState {
	lastSeg: number;
	lastT: number;
	departureTime: number;
	nextStationList: StationEntry[];
	nextStationPtr: number;
	direction: "forward" | "reverse"; // Add direction tracking
}

interface StationEntry {
	name: string;
	idx: number;
}

interface SegmentHistoryEntry {
	avg: number;
	alpha: number;
}

// State & history (keyed by trainName)
const trainState = new Map<string, TrainState>();
const SegmentHistory = new Map<string, Map<number, SegmentHistoryEntry>>();
const LiveDelays = new Map<string, number>();
const Filters = new Map<string, SimpleKalmanFilter>();

// Helper: record departure into history
function recordDeparture(trainName: string, state: TrainState): void {
	if (state.lastSeg !== undefined && state.departureTime !== undefined) {
		const delta = tick() - state.departureTime;
		const hist = SegmentHistory.get(trainName) || new Map<number, SegmentHistoryEntry>();
		const e = hist.get(state.lastSeg) || { avg: delta, alpha: 0.2 };
		e.avg = e.alpha * delta + (1 - e.alpha) * e.avg;
		hist.set(state.lastSeg, e);
		SegmentHistory.set(trainName, hist);
	}
	state.departureTime = tick();
}

// Helper: raw ETA from current to waypoint wpIdx
function etaToWp(wpIdx: number, bestSeg: number, state: TrainState, baseAvg: number, trainName: string): number {
	let eta = (1 - state.lastT) * baseAvg;
	for (let seg = bestSeg + 1; seg < wpIdx; seg++) {
		const he = SegmentHistory.get(trainName)?.get(seg);
		const avg =
			he?.avg !== undefined
				? he.avg
				: CleanedScheduleSimple.Main[seg] !== undefined
					? CleanedScheduleSimple.Main[seg]
					: baseAvg;
		eta = eta + avg;
	}
	return eta;
}

// Main update loop
RunService.Heartbeat.Connect(() => {
	const trainsFolder = Workspace.WaitForChild("Trains") as Folder;

	for (const train of trainsFolder.GetChildren()) {
		if (!train.IsA("Model")) continue;

		const name = train.Name;
		const part = train.PrimaryPart;
		if (!part) continue;

		// Skip AI trains - they are managed by RouteSpawner which broadcasts their own positions
		if (string.sub(name, 1, 3) === "AI_") {
			continue;
		}

		// 1) Determine route from train name
		let shapeKey = "Main"; // Default fallback

		// Try simple string operations instead of regex (check longer patterns first)
		// eslint-disable-next-line roblox-ts/lua-truthiness
		if (name.find("_R001X")[0]) {
			shapeKey = "R001X";
			// eslint-disable-next-line roblox-ts/lua-truthiness
		} else if (name.find("_R001")[0]) {
			shapeKey = "R001";
			// eslint-disable-next-line roblox-ts/lua-truthiness
		} else if (name.find("_R026")[0]) {
			shapeKey = "R026";
			// eslint-disable-next-line roblox-ts/lua-truthiness
		} else if (name.find("_R029")[0]) {
			shapeKey = "R029";
		}

		// Initialize state & filter if new
		let state = trainState.get(name);
		if (!state) {
			// build sorted station list from the correct route shape
			const routeShape = RouteShapes[shapeKey];
			const rawList = routeShape?.stationIndices || {};
			const list: StationEntry[] = [];

			for (const [stName, wpIdx] of pairs(rawList)) {
				list.push({ name: tostring(stName), idx: wpIdx });
			}
			list.sort((a, b) => a.idx < b.idx);

			state = {
				lastSeg: 1,
				lastT: 0,
				departureTime: tick(),
				nextStationList: list,
				nextStationPtr: 1,
				direction: "forward", // Initialize direction
			};
			trainState.set(name, state);
			Filters.set(name, KalmanSimple.create());
		}

		// 2) Get the route shape

		const shape = RouteShapes[shapeKey];
		if (!shape) {
			warn(`No route shape found for ${shapeKey}, skipping train ${name}`);
			continue;
		}

		const wps = shape.worldWaypoints;

		// 3) Handle terminal behavior and bidirectional movement
		const maxSeg = wps.size() - 1;

		// For reversible routes, handle smooth bidirectional movement
		if (shape.allowReverse) {
			// Check if train reached forward terminus
			if (state.direction === "forward" && state.lastSeg >= maxSeg && state.lastT >= 0.99) {
				print(`DEBUG: Train ${name} reached forward terminus, reversing direction`);
				state.direction = "reverse";
				state.lastSeg = maxSeg;
				state.lastT = 0.99; // Stay at terminus momentarily
			}
			// Check if train reached reverse terminus (origin)
			else if (state.direction === "reverse" && state.lastSeg <= 1 && state.lastT <= 0.01) {
				print(`DEBUG: Train ${name} reached reverse terminus, reversing direction`);
				state.direction = "forward";
				state.lastSeg = 1;
				state.lastT = 0.01; // Stay at origin momentarily
			}
		} else {
			// Legacy behavior for non-reversible routes (like old Main route)
			if (state.lastSeg === maxSeg && state.lastT >= 0.99) {
				state.lastSeg = 1;
				state.lastT = 0;
				state.direction = "forward"; // Reset direction
			}
		}

		// 4) Map-match: find nearest segment & fraction (respecting direction)
		const pos3 = part.Position;
		let bestD = math.huge;
		let bestSeg = 1;
		let bestT = 0;
		let bestPos = pos3;

		for (let i = 0; i < wps.size() - 1; i++) {
			const A = wps[i];
			const B = wps[i + 1];
			const [proj, t] = MapUtilsSimple.projectOntoSegment(A, B, pos3);
			const d = pos3.sub(proj).Magnitude;
			if (d < bestD) {
				bestD = d;
				bestSeg = i + 1; // Convert to 1-based indexing
				bestT = t;
				bestPos = proj;
			}
		}

		// Do NOT invert t. Keep t normalized 0..1 from lower->higher waypoint.
		// The client uses 'direction' only to flip the icon's facing.

		// Canonicalize representation at waypoints to avoid seg toggling
		const maxSegments = math.max(wps.size() - 1, 1);
		const EPS = 1e-4; // small tolerance

		// Rule:
		//   t ≈ 0   -> represent as the *end of previous segment* (seg-1, t=1)
		//   t ≈ 1   -> represent as the *end of current segment* (seg,   t=1)
		// EXCEPTION: Don't move backwards if we're at a terminus position
		const isAtOriginTerminus =
			bestSeg === 1 &&
			((state.direction === "forward" && bestT <= EPS) || (state.direction === "reverse" && bestT >= 1 - EPS));
		const isAtEndTerminus =
			bestSeg === maxSegments &&
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

		state.lastSeg = bestSeg;
		state.lastT = bestT;

		// 5) Determine base average for this segment
		const histE = SegmentHistory.get(name)?.get(bestSeg);
		const baseAvg =
			histE?.avg !== undefined
				? histE.avg
				: CleanedScheduleSimple.Main[bestSeg] !== undefined
					? CleanedScheduleSimple.Main[bestSeg]
					: 30;

		// 7) Build per-station ETAs, with arrival resets
		const stationETAs = new Map<string, number>();
		const kf = Filters.get(name)!;
		const liveDelay = LiveDelays.get(name) !== undefined ? LiveDelays.get(name)! : 0;

		const list = state.nextStationList;
		const ptr = state.nextStationPtr;

		// Always calculate ETAs for all stations, regardless of pointer position
		for (const entry of list) {
			const stName = entry.name;
			const wpIdx = entry.idx; // This is already 0-based from RouteShapes

			// Calculate raw ETA
			const rawETA = etaToWp(wpIdx + 1, bestSeg, state, baseAvg, name) + liveDelay; // +1 because etaToWp expects 1-based wpIdx

			// Check if this is the current target station
			if (ptr <= list.size() && stName === list[ptr - 1].name) {
				// Fix arrival detection: bestSeg is 1-based, wpIdx is 0-based
				// Train arrives when it's on the segment containing the station waypoint
				const arrived = bestSeg > wpIdx + 1 || (bestSeg === wpIdx + 1 && state.lastT >= 0.99);

				if (arrived) {
					// Zero ETA on arrival but don't reset Kalman abruptly
					stationETAs.set(stName, 0);

					// Only advance pointer and record departure once
					if (state.nextStationPtr === ptr) {
						recordDeparture(name, state);
						state.nextStationPtr = ptr + 1;
					}
				} else {
					// Not yet arrived: smooth ETA with gentler Kalman reset if needed
					const smoothedETA = KalmanSimple.update(kf, rawETA);
					stationETAs.set(stName, smoothedETA);
				}
			} else {
				// Future stations or past stations: calculate ETA normally
				if (rawETA > 0) {
					// Only show positive ETAs
					const smoothedETA = KalmanSimple.update(kf, rawETA);
					stationETAs.set(stName, smoothedETA);
				}
			}
		}

		// 8) Add bounds checking (segments are 1..#wps-1)
		const maxSegIdx = math.max(wps.size() - 1, 1);
		const safeSeg = math.clamp(state.lastSeg, 1, maxSegIdx);
		const safeT = math.clamp(state.lastT, 0, 1);

		// Broadcast to all clients (include direction for client-side interpolation)
		MapEvent.FireAllClients(name, safeSeg, safeT, stationETAs, bestPos, shapeKey, state.direction);
	}
});

// Example functions to send schedule and modification updates
export function broadcastScheduleUpdate(trainName: string, segmentTimes: { [key: number]: number }): void {
	ScheduleEvent.FireAllClients(trainName, segmentTimes);
	print(`Broadcasted schedule update for train: ${trainName}`);
}

export function broadcastTripModification(modification: TripModification): void {
	ModificationEvent.FireAllClients(modification);
	print(`Broadcasted trip modification: ${modification.modificationType} for trip ${modification.tripId}`);
}

// Example usage - uncomment to test
// spawn(() => {
// 	wait(5); // Wait 5 seconds after server start
// 	broadcastScheduleUpdate("Train1", { 1: 14, 2: 13, 3: 9, 4: 10 });
// 	broadcastTripModification({
// 		tripId: "trip_001",
// 		trainName: "Train1",
// 		modificationType: "detour",
// 		triggerType: "station",
// 		triggerValue: "Station A",
// 		shapeKey: "DetourRoute",
// 		direction: "forward"
// 	});
// });

print("Map Broadcaster initialized - tracking trains and broadcasting ETAs");
print("RemoteEvents created: MapUpdateEvent, ScheduleUpdateEvent, TripModificationEvent");
