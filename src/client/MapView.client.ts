// MapView.client.ts - Exact 1:1 match with Lua version

import { Players, TweenService, ReplicatedStorage } from "@rbxts/services";
import { RouteShapes } from "shared/RouteShapes";
import { RouteDefinitions } from "shared/RouteDefinitions";

// Direct RemoteEvent access like Lua
const MapEvent = ReplicatedStorage.WaitForChild("MapUpdateEvent") as RemoteEvent;

const player = Players.LocalPlayer!;
const gui = player.WaitForChild("PlayerGui") as PlayerGui;

// 1) Build static mini-map - EXACT Lua match
const screen = new Instance("ScreenGui", gui);
screen.Name = "MiniMap";
screen.ResetOnSpawn = false;

const mapBG = new Instance("ImageLabel", screen);
mapBG.Name = "MapBG";
mapBG.Image = "rbxassetid://YOUR_MAP_DECAL_ID";
mapBG.Size = new UDim2(0.35, 0, 0.35, 0);
mapBG.Position = new UDim2(0.02, 0, 0.02, 0);
mapBG.BackgroundTransparency = 1;

const aspectRatioConstraint = new Instance("UIAspectRatioConstraint", mapBG);
aspectRatioConstraint.AspectRatio = 1;

// 2) UI projection helper
function uiToPixel(v2: Vector2): Vector2 {
	const size = mapBG.AbsoluteSize;
	return new Vector2(v2.X * size.X, v2.Y * size.Y);
}

// 3) Route colors for different operators
const operatorColors = {
	Connect: new Color3(0, 0.5, 1), // Blue
	Metro: new Color3(1, 0, 0), // Red
	Waterline: new Color3(0, 0.8, 0.8), // Teal
	AirLink: new Color3(1, 1, 0), // Yellow
	Express: new Color3(0, 0.5, 0), // Dark Green
	Training: new Color3(0.7, 0.7, 0.7), // Light Grey
	Main: new Color3(1, 1, 1), // White (legacy)
};

// 4) Draw route lines for all routes
const routePaths: { [routeKey: string]: Path2D } = {};

function createRouteLine(routeKey: string, uiWaypoints: Vector2[], color: Color3): void {
	if (uiWaypoints.size() < 2) return; // Need at least 2 points for a line

	const path = new Instance("Path2D", mapBG);
	path.Name = `RouteLine_${routeKey}`;
	path.Thickness = 3;
	path.Color3 = color;

	const cps: Path2DControlPoint[] = [];
	for (let i = 0; i < uiWaypoints.size(); i++) {
		const uv = uiWaypoints[i];
		cps[i] = new Path2DControlPoint(new UDim2(uv.X, 0, uv.Y, 0));
	}
	path.SetControlPoints(cps);

	routePaths[routeKey] = path;
	print(`Created route line for ${routeKey} with ${uiWaypoints.size()} waypoints`);
}

// Draw lines for each route with proper colors
for (const [routeKey, routeData] of pairs(RouteShapes)) {
	const routeKeyStr = tostring(routeKey);

	// Determine color based on route
	let color = operatorColors.Main; // Default

	// Try to get route-specific color from RouteDefinitions
	const routeDef = RouteDefinitions[routeKeyStr];
	if (routeDef) {
		color = routeDef.lineColor || operatorColors[routeDef.operator as keyof typeof operatorColors] || color;
	} else {
		// Fallback to operator color if available
		if (operatorColors[routeKeyStr as keyof typeof operatorColors]) {
			color = operatorColors[routeKeyStr as keyof typeof operatorColors];
		}
	}

	createRouteLine(routeKeyStr, routeData.uiWaypoints, color);
	print(`Drawing route ${routeKeyStr} with color R:${color.R} G:${color.G} B:${color.B}`);
}

// 4) Icons & per-station ETA list - EXACT Lua match
interface TrainIconData {
	icon: ImageLabel;
	frame: Frame;
	last: Vector2;
}

const icons: { [key: string]: TrainIconData } = {};

MapEvent.OnClientEvent.Connect(
	(
		trainName: string,
		segIdx: number,
		t: number,
		stationETAs: { [key: string]: number },
		worldPos: Vector3,
		shapeKey: string,
	) => {
		if (mapBG.AbsoluteSize.X === 0) return;

		// Get the correct route's UI waypoints
		const routeData = RouteShapes[shapeKey] || RouteShapes.Main;
		const uiWaypoints = routeData.uiWaypoints;

		if (!uiWaypoints || uiWaypoints.size() === 0) {
			warn(`No UI waypoints found for route ${shapeKey}`);
			return;
		}

		// Manual UI interpolation using the correct route's waypoints
		const clamped = math.clamp(segIdx, 1, uiWaypoints.size() - 1);
		const A = uiToPixel(uiWaypoints[clamped - 1]); // Convert Lua 1-based to TS 0-based
		const B = uiToPixel(uiWaypoints[clamped]); // Convert Lua 1-based to TS 0-based
		const uiPos = A.add(B.sub(A).mul(t));

		// Debug jittery trains
		// eslint-disable-next-line roblox-ts/lua-truthiness
		if (trainName.find("R026")[0] && math.floor(tick()) % 2 === 0) {
			print(
				`DEBUG R026: ${trainName} - segIdx:${segIdx}, t:${math.floor(t * 100) / 100}, clamped:${clamped}, uiPos:(${math.floor(uiPos.X)},${math.floor(uiPos.Y)})`,
			);
		}

		// Create icon & frame once - EXACT Lua match
		if (!icons[trainName]) {
			const icon = new Instance("ImageLabel", mapBG);
			icon.Size = new UDim2(0, 24, 0, 24);
			icon.AnchorPoint = new Vector2(0.5, 0.5);
			icon.Image = "rbxassetid://YOUR_TRAIN_ICON_ID";

			const frame = new Instance("Frame", mapBG);
			frame.Name = `${trainName}_StationList`;
			frame.BackgroundTransparency = 1;
			frame.Position = new UDim2(1, -140, 0, 10);

			icons[trainName] = { icon: icon, frame: frame, last: uiPos };
		}

		const st = icons[trainName];

		// Move icon
		st.icon.TweenPosition(
			UDim2.fromOffset(uiPos.X, uiPos.Y),
			Enum.EasingDirection.Out,
			Enum.EasingStyle.Quad,
			0.1,
			true,
		);

		// Calculate rotation based on line segment direction (like TripView)
		let rotationAngle = 0;
		if (uiWaypoints.size() >= 2) {
			const currentSegment = math.clamp(clamped, 1, uiWaypoints.size() - 1);
			const segmentStart = clamped > 0 ? clamped - 1 : 0;
			const segmentEnd = clamped < uiWaypoints.size() - 1 ? clamped : uiWaypoints.size() - 1;

			const startPixel = uiToPixel(uiWaypoints[segmentStart]);
			const endPixel = uiToPixel(uiWaypoints[segmentEnd]);
			const lineDirection = endPixel.sub(startPixel);

			if (lineDirection.Magnitude > 0) {
				rotationAngle = math.deg(math.atan2(lineDirection.Y, lineDirection.X));
			}
		}

		// Apply rotation to match line direction
		TweenService.Create(st.icon, new TweenInfo(0.1), { Rotation: rotationAngle }).Play();
		st.last = uiPos;

		// Render ETA list - EXACT Lua match
		st.frame.ClearAllChildren();
		const list: Array<{ name: string; eta: number }> = [];

		for (const [name, eta] of pairs(stationETAs || {})) {
			list.push({ name: tostring(name), eta: eta });
		}
		list.sort((a, b) => a.eta < b.eta);
		st.frame.Size = new UDim2(0, 120, 0, list.size() * 20);

		for (let i = 0; i < list.size(); i++) {
			const e = list[i];

			const lbl = new Instance("TextLabel", st.frame);
			lbl.Size = new UDim2(1, 0, 0, 20);
			lbl.Position = new UDim2(0, 0, 0, i * 20);
			lbl.BackgroundTransparency = 1;
			lbl.Font = Enum.Font.SourceSans;
			lbl.TextSize = 14;
			lbl.TextXAlignment = Enum.TextXAlignment.Left;

			const mins = math.floor(e.eta / 60);
			const secs = math.floor(e.eta % 60);
			const text =
				e.eta < 60
					? `${e.name}: 0:${secs < 10 ? "0" + secs : secs}`
					: `${e.name}: ${secs >= 40 ? mins + 1 : mins} min`;

			lbl.Text = text;
			lbl.TextColor3 = new Color3(1, 1, 1);
		}
	},
);
