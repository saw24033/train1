// KalmanSimple.ts - Simple Kalman filter for train position smoothing

export interface SimpleKalmanFilter {
	x: number;
	P: number;
	initialized: boolean;
}

export interface KalmanPrediction {
	predictedPosition: number;
	predictedVelocity: number;
	confidence: number;
}

export class TrainKalmanFilter {
	private filter: SimpleKalmanFilter;
	private lastPosition: number;
	private lastTime: number;
	private velocity: number;

	constructor(initialPosition: number, processNoise: number, measurementNoise: number) {
		this.filter = KalmanSimple.create();
		this.lastPosition = initialPosition;
		this.lastTime = tick();
		this.velocity = 0;
	}

	public update(position: number, velocity: number): void {
		KalmanSimple.update(this.filter, position);
		this.lastPosition = position;
		this.velocity = velocity;
		this.lastTime = tick();
	}

	public predict(deltaTimeMs: number): KalmanPrediction {
		const deltaTime = deltaTimeMs / 1000;
		const predictedPosition = this.filter.x + this.velocity * deltaTime;

		return {
			predictedPosition: predictedPosition,
			predictedVelocity: this.velocity,
			confidence: 1.0 - this.filter.P / 1e6,
		};
	}

	public getPosition(): number {
		return this.filter.x;
	}

	public getVelocity(): number {
		return this.velocity;
	}
}

export class KalmanSimple {
	public static create(): SimpleKalmanFilter {
		// start x=0 but with huge uncertainty,
		// so first K = P/(P+R) ≈ 1
		return {
			x: 0,
			P: 1e6,
			initialized: false,
		};
	}

	public static update(kf: SimpleKalmanFilter, measurement: number): number {
		// 1) On the very first measurement, just take it verbatim:
		if (!kf.initialized) {
			kf.x = measurement;
			kf.P = 1e6; // keep uncertainty high
			kf.initialized = true;
			return measurement;
		}

		// 2) Standard Kalman update
		const R = 5; // measurement noise variance
		const K = kf.P / (kf.P + R);

		kf.x = kf.x + K * (measurement - kf.x);
		kf.P = (1 - K) * kf.P;

		return kf.x;
	}
}

export default KalmanSimple;
