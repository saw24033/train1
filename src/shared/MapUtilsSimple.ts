// MapUtilsSimple.ts - Simple map utilities for train positioning

export interface WorldCoordinate {
	x: number;
	y: number;
	z: number;
}

export interface UICoordinate {
	x: number;
	y: number;
}

export interface MapBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	minZ: number;
	maxZ: number;
}

export class MapCoordinateTransformer {
	constructor(
		private bounds: MapBounds,
		private uiWidth: number,
		private uiHeight: number,
	) {}

	public worldToUI(worldCoord: WorldCoordinate): UICoordinate {
		const normalizedX = (worldCoord.x - this.bounds.minX) / (this.bounds.maxX - this.bounds.minX);
		const normalizedZ = (worldCoord.z - this.bounds.minZ) / (this.bounds.maxZ - this.bounds.minZ);

		return {
			x: normalizedX * this.uiWidth,
			y: normalizedZ * this.uiHeight,
		};
	}

	public uiToWorld(uiCoord: UICoordinate): WorldCoordinate {
		const normalizedX = uiCoord.x / this.uiWidth;
		const normalizedZ = uiCoord.y / this.uiHeight;

		return {
			x: this.bounds.minX + normalizedX * (this.bounds.maxX - this.bounds.minX),
			y: 0.5, // Default Y level
			z: this.bounds.minZ + normalizedZ * (this.bounds.maxZ - this.bounds.minZ),
		};
	}
}

export class MapUtilsSimple {
	// Projects point p onto segment AB, returns the closest point and fraction t
	public static projectOntoSegment(a: Vector3, b: Vector3, p: Vector3): [Vector3, number] {
		const ab = b.sub(a);
		const ap = p.sub(a);
		const t = math.clamp(ap.Dot(ab) / ab.Dot(ab), 0, 1);
		return [a.add(ab.mul(t)), t];
	}
}

export default MapUtilsSimple;
