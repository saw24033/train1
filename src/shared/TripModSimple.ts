// TripModSimple.ts - Simple trip modification rules

export interface TripModRule {
	type: "station" | "segment";
	value: string | number; // station name or segment index
	shape: string; // e.g. "DetourA"
	direction: "forward" | "backward" | "both";
}

export interface TrainState {
	currentStation?: string;
	lastSeg: number;
	isReturning: boolean;
}

export interface TripModification {
	tripId: string;
	trainName: string;
	modificationType: "detour" | "skip" | "delay";
	triggerType: "station" | "segment";
	triggerValue: string | number;
	shapeKey: string;
	direction: "forward" | "backward" | "both";
	expiryTime?: number;
}

export enum TripStatus {
	Normal = "normal",
	Modified = "modified",
	Delayed = "delayed",
	Cancelled = "cancelled",
}

export class TripModificationManager {
	private modifications: Map<string, TripModification[]> = new Map();
	private tripModSimple: TripModSimple = new TripModSimple();

	public addModification(modification: TripModification): void {
		if (!this.modifications.has(modification.trainName)) {
			this.modifications.set(modification.trainName, []);
		}

		const trainMods = this.modifications.get(modification.trainName)!;
		trainMods.push(modification);

		// Also add to simple rule system
		this.tripModSimple.addRule(
			modification.trainName,
			modification.triggerType,
			modification.triggerValue,
			modification.shapeKey,
			modification.direction,
		);
	}

	public cleanupExpiredModifications(): void {
		const currentTime = tick() * 1000;

		this.modifications.forEach((mods, trainName) => {
			const validMods = mods.filter((mod) => mod.expiryTime === undefined || mod.expiryTime > currentTime);

			if (validMods.size() !== mods.size()) {
				this.modifications.set(trainName, validMods);
				// Rebuild simple rules for this train
				this.tripModSimple.clearRules(trainName);
				validMods.forEach((mod) => {
					this.tripModSimple.addRule(
						mod.trainName,
						mod.triggerType,
						mod.triggerValue,
						mod.shapeKey,
						mod.direction,
					);
				});
			}
		});
	}

	public getActiveModifications(trainName: string): TripModification[] {
		return this.modifications.get(trainName) || [];
	}

	public getTripStatus(trainName: string): TripStatus {
		const mods = this.getActiveModifications(trainName);
		return mods.size() > 0 ? TripStatus.Modified : TripStatus.Normal;
	}
}

export class TripModSimple {
	private rules: Map<string, TripModRule[]> = new Map();

	public addRule(
		trainName: string,
		triggerType: "station" | "segment",
		triggerValue: string | number,
		shapeKey: string,
		direction: "forward" | "backward" | "both" = "both",
	): void {
		if (!this.rules.has(trainName)) {
			this.rules.set(trainName, []);
		}

		const trainRules = this.rules.get(trainName)!;
		trainRules.push({
			type: triggerType,
			value: triggerValue,
			shape: shapeKey,
			direction: direction,
		});
	}

	public clearRules(trainName: string): void {
		this.rules.delete(trainName);
	}

	// Given current state, pick which shape to use
	// state.currentStation, state.lastSeg, state.isReturning
	public getShapeFor(trainName: string, state: TrainState): string {
		const trainRules = this.rules.get(trainName) || [];
		let active = "Main";

		for (const rule of trainRules) {
			const okDir =
				rule.direction === "both" ||
				(rule.direction === "forward" && !state.isReturning) ||
				(rule.direction === "backward" && state.isReturning);

			if (okDir) {
				if (rule.type === "station" && rule.value === state.currentStation) {
					active = rule.shape;
				} else if (rule.type === "segment" && state.lastSeg >= (rule.value as number)) {
					active = rule.shape;
				}
			}
		}

		return active;
	}
}

export default TripModSimple;
