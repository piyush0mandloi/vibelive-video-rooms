import { describe, expect, it } from "vitest";
import { mergeMessages } from "../features/messaging/messageUtils";

describe("message list merging", () => {
  it("renders a message once when send response and realtime event both arrive", () => {
    const saved = { id: "a", sender_id: "u1", content: "hi", created_at: "2026-10-21T10:00:00Z" };
    const merged = mergeMessages(mergeMessages([], [saved]), [{ ...saved }]);
    expect(merged).toHaveLength(1);
  });

  it("keeps chronological order when older pages are merged in", () => {
    const newer = [{ id: "c", created_at: "2026-10-21T10:02:00Z" }, { id: "d", created_at: "2026-10-21T10:03:00Z" }];
    const older = [{ id: "a", created_at: "2026-10-21T10:00:00Z" }, { id: "b", created_at: "2026-10-21T10:01:00Z" }];
    expect(mergeMessages(newer, older).map((m) => m.id)).toEqual(["a", "b", "c", "d"]);
  });
});
