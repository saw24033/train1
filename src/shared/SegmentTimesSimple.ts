// SegmentTimesSimple.ts - Simple segment timing calculations

export interface SegmentTime {
	segmentIndex: number;
	averageTime: number;
	minTime: number;
	maxTime: number;
	confidence: number;
}

export class SegmentTimesCalculator {
	private segmentTimes: Map<number, SegmentTime> = new Map();

	constructor() {
		// Initialize with default segment times
		this.segmentTimes.set(1, {
			segmentIndex: 1,
			averageTime: 14,
			minTime: 12,
			maxTime: 16,
			confidence: 0.9,
		});

		this.segmentTimes.set(2, {
			segmentIndex: 2,
			averageTime: 13,
			minTime: 11,
			maxTime: 15,
			confidence: 0.85,
		});

		this.segmentTimes.set(3, {
			segmentIndex: 3,
			averageTime: 9,
			minTime: 8,
			maxTime: 11,
			confidence: 0.92,
		});

		this.segmentTimes.set(4, {
			segmentIndex: 4,
			averageTime: 10,
			minTime: 9,
			maxTime: 12,
			confidence: 0.88,
		});
	}

	public getSegmentTime(segmentIndex: number): SegmentTime {
		return (
			this.segmentTimes.get(segmentIndex) || {
				segmentIndex: segmentIndex,
				averageTime: 10,
				minTime: 8,
				maxTime: 12,
				confidence: 0.5,
			}
		);
	}

	public updateSegmentTime(segmentIndex: number, actualTime: number): void {
		const existing = this.segmentTimes.get(segmentIndex);
		if (existing) {
			// Simple exponential moving average
			const alpha = 0.1;
			existing.averageTime = existing.averageTime * (1 - alpha) + actualTime * alpha;
			existing.minTime = math.min(existing.minTime, actualTime);
			existing.maxTime = math.max(existing.maxTime, actualTime);
		} else {
			this.segmentTimes.set(segmentIndex, {
				segmentIndex: segmentIndex,
				averageTime: actualTime,
				minTime: actualTime,
				maxTime: actualTime,
				confidence: 0.5,
			});
		}
	}

	public getAllSegmentTimes(): SegmentTime[] {
		const times: SegmentTime[] = [];
		this.segmentTimes.forEach((segmentTime) => {
			times.push(segmentTime);
		});
		return times;
	}
}

export default SegmentTimesCalculator;
