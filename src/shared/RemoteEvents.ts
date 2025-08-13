// RemoteEvents.ts - Centralized RemoteEvent definitions and management

import { ReplicatedStorage } from "@rbxts/services";

export const REMOTE_EVENT_NAMES = {
	MAP_UPDATE: "MapUpdateEvent",
	ROUTE_SPAWNER_UPDATE: "RouteSpawnerUpdateEvent",
	SCHEDULE_UPDATE: "ScheduleUpdateEvent",
	TRIP_MODIFICATION: "TripModificationEvent",
} as const;

export type RemoteEventName = (typeof REMOTE_EVENT_NAMES)[keyof typeof REMOTE_EVENT_NAMES];

// Server-side RemoteEvent creation
export function createRemoteEvents(): Record<string, RemoteEvent> {
	const events: Record<string, RemoteEvent> = {};

	for (const [key, eventName] of pairs(REMOTE_EVENT_NAMES)) {
		let event = ReplicatedStorage.FindFirstChild(eventName) as RemoteEvent;
		if (!event) {
			event = new Instance("RemoteEvent");
			event.Name = eventName;
			event.Parent = ReplicatedStorage;
		}
		events[eventName] = event;
	}

	return events;
}

// Client-side RemoteEvent connection
export function connectToRemoteEvents(): Record<string, RemoteEvent> {
	const events: Record<string, RemoteEvent> = {};

	for (const [key, eventName] of pairs(REMOTE_EVENT_NAMES)) {
		const event = ReplicatedStorage.WaitForChild(eventName) as RemoteEvent;
		events[eventName] = event;
	}

	return events;
}

export default {
	NAMES: REMOTE_EVENT_NAMES,
	createRemoteEvents,
	connectToRemoteEvents,
};
