import { describe, expect, it } from "vitest";
import { ticketOnRampService } from "./ticket-on-ramps.js";

describe("BYO Ticket On-Ramp Service", () => {
  it("formats outbound mirror comments cleanly for Linear/Jira/Asana", () => {
    const service = ticketOnRampService({} as any);
    const comment = service.formatOutboundMirrorComment(
      { id: "iss-123", title: "Refactor auth middleware", status: "done" },
      "https://paperclip.local/artifacts/report.pdf",
    );

    expect(comment).toContain("Paperclip Control Plane Update");
    expect(comment).toContain("`DONE`");
    expect(comment).toContain("Refactor auth middleware");
    expect(comment).toContain("https://paperclip.local/artifacts/report.pdf");
  });
});
