import { describe, expect, it, vi } from "vitest";
const { fetchToken, developmentTokenServer } = vi.hoisted(() => ({ fetchToken: vi.fn(), developmentTokenServer: vi.fn() }));
vi.mock("livekit-client", () => ({ TokenSource: { developmentTokenServer }, Room: vi.fn(), RoomEvent: {}, Track: { Source: {} } }));
import { fetchRoomCredentials } from "../components/LiveKitCall";
import { sanitizeRoom } from "../components/VibeLive";

describe("LiveKit prototype", () => {
  it("uses the supplied development server and selected room, not an agent session", async () => {
    developmentTokenServer.mockReturnValue({ fetch: fetchToken });
    fetchToken.mockResolvedValue({ serverUrl: "wss://test.example", participantToken: "test-token" });
    expect(await fetchRoomCredentials("T2", "Piyush", "device-a")).toEqual({ serverUrl: "wss://test.example", participantToken: "test-token" });
    expect(developmentTokenServer).toHaveBeenCalledWith("vibelive-1j40t6");
    expect(fetchToken).toHaveBeenCalledWith({ roomName: "T2", participantName: "Piyush", participantIdentity: "device-a" });
  });
  it("preserves the exact shared room on both devices", () => {
    expect(sanitizeRoom(new URLSearchParams("room=T2").get("room"))).toBe("T2");
  });
});