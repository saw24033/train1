// RouteSelection.client.ts - Player route selection UI
import { Players, ReplicatedStorage, UserInputService } from "@rbxts/services";
import { RouteManager } from "shared/RouteDefinitions";

const player = Players.LocalPlayer;

// Wait for RouteSelection RemoteEvent
const RouteSelectionEvent = ReplicatedStorage.WaitForChild("RouteSelection") as RemoteEvent;

// Simple key-based route selection for testing
const routeKeys: { [key: string]: string } = {
	["1"]: "R001", // Press 1 for R001
	["2"]: "R029", // Press 2 for R029
	["3"]: "R026", // Press 3 for R026
};

print("Route Selection Client loaded");
print("Press 1, 2, or 3 to select routes:");
print("1 = R001 (Stepford Central <> Airport Central)");
print("2 = R029 (Stepford Victoria <> Beechley)");
print("3 = R026 (Stepford Victoria <> Llyn-by-the-Sea)");

UserInputService.InputBegan.Connect((input, gameProcessed) => {
	if (gameProcessed) return;

	if (input.KeyCode === Enum.KeyCode.One) {
		selectRoute("R001");
	} else if (input.KeyCode === Enum.KeyCode.Two) {
		selectRoute("R029");
	} else if (input.KeyCode === Enum.KeyCode.Three) {
		selectRoute("R026");
	}
});

function selectRoute(routeId: string): void {
	const route = RouteManager.getRoute(routeId);
	if (!route) {
		warn(`Invalid route: ${routeId}`);
		return;
	}

	print(`Selecting route ${route.routeNumber}: ${route.displayName}`);
	print(`Operator: ${route.operator} | Journey: ${route.journeyTime.forward}/${route.journeyTime.reverse} min`);

	// Fire to server
	RouteSelectionEvent.FireServer(routeId);
}
