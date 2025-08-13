// CleanedScheduleSimple.ts - Simple cleaned schedule data

export interface CleanedScheduleData {
	[segmentIndex: number]: number; // cleaned time for each segment
}

export interface CleanedSchedule {
	trainId: string;
	segments: CleanedScheduleData;
	totalTime: number;
	isValid: boolean;
}

export class CleanedScheduleProcessor {
	public processRawSchedule(rawData: unknown): CleanedSchedule {
		// Simple processing - in real implementation would parse complex data
		return {
			trainId: "default",
			segments: CleanedScheduleSimple.Main,
			totalTime: 46, // sum of all segment times
			isValid: true,
		};
	}

	public getSegmentTime(segmentIndex: number): number {
		return CleanedScheduleSimple.Main[segmentIndex] !== undefined ? CleanedScheduleSimple.Main[segmentIndex] : 10; // default 10 seconds
	}
}

export interface CleanedScheduleSimple {
	Main: CleanedScheduleData;
}

export const CleanedScheduleSimple: CleanedScheduleSimple = {
	Main: {
		[1]: 14, // cleaned time for waypoint 1→2
		[2]: 13, // cleaned time for 2→3
		[3]: 9, // cleaned time for 3→4
		[4]: 10, // cleaned time for 4→5
		// Add more segments as needed
	},
};

export default CleanedScheduleSimple;
