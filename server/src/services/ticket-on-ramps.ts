import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { externalObjects, issues } from "@paperclipai/db";
import type { ExternalTicketPayload, TicketSyncResult } from "@paperclipai/shared";

export function ticketOnRampService(db: Db) {
  return {
    async syncInboundTicket(
      companyId: string,
      payload: ExternalTicketPayload,
    ): Promise<TicketSyncResult> {
      const providerKey = `ticket_${payload.provider}`;

      // Check existing external object binding
      const [existingObj] = await db
        .select()
        .from(externalObjects)
        .where(
          and(
            eq(externalObjects.companyId, companyId),
            eq(externalObjects.providerKey, providerKey),
            eq(externalObjects.externalId, payload.externalId),
          ),
        )
        .limit(1);

      if (existingObj && existingObj.data?.paperclipIssueId) {
        // Update existing issue
        const issueId = existingObj.data.paperclipIssueId as string;
        await db
          .update(issues)
          .set({
            title: payload.title,
            description: payload.description,
            updatedAt: new Date(),
          })
          .where(and(eq(issues.companyId, companyId), eq(issues.id, issueId)));

        return {
          linkedIssueId: issueId,
          externalId: payload.externalId,
          provider: payload.provider,
          action: "updated",
        };
      }

      // Create new canonical issue
      const [newIssue] = await db
        .insert(issues)
        .values({
          companyId,
          title: `[${payload.provider.toUpperCase()} ${payload.externalId}] ${payload.title}`,
          description: [
            payload.description ?? "",
            "",
            "---",
            `**Source Ticket**: [${payload.externalId}](${payload.url ?? "#"}) (${payload.provider})`,
          ].join("\n"),
          status: "todo",
          priority: payload.priority === "high" || payload.priority === "urgent" ? "high" : "medium",
        })
        .returning();

      // Bind in external_objects table
      await db.insert(externalObjects).values({
        companyId,
        providerKey,
        objectType: "ticket",
        externalId: payload.externalId,
        displayTitle: payload.title,
        sanitizedCanonicalUrl: payload.url,
        data: {
          paperclipIssueId: newIssue.id,
          provider: payload.provider,
          syncedAt: new Date().toISOString(),
        },
      });

      return {
        linkedIssueId: newIssue.id,
        externalId: payload.externalId,
        provider: payload.provider,
        action: "created",
      };
    },

    formatOutboundMirrorComment(
      issue: { id: string; title: string; status: string },
      deliverableUrl?: string,
    ): string {
      const lines = [
        `🤖 **Paperclip Control Plane Update**`,
        `- **Issue Status**: \`${issue.status.toUpperCase()}\``,
        `- **Title**: ${issue.title}`,
      ];

      if (deliverableUrl) {
        lines.push(`- **Verified Deliverable**: [View Artifact](${deliverableUrl})`);
      }

      lines.push(`*Managed by Paperclip Autonomous Control Plane*`);
      return lines.join("\n");
    },

    /**
     * Mirror a terminal issue status back to the external ticket it came from.
     * The outbound body is written to the bound `external_objects` row so the
     * operator can inspect exactly what would be (or was) delivered. Returns
     * null when the issue has no external ticket binding.
     */
    async mirrorIssueStatusToExternalTicket(
      companyId: string,
      issue: { id: string; title: string; status: string },
      opts: { deliverableUrl?: string | null } = {},
    ): Promise<{ externalObjectId: string; body: string } | null> {
      const bindings = await db
        .select()
        .from(externalObjects)
        .where(
          and(
            eq(externalObjects.companyId, companyId),
            eq(externalObjects.objectType, "ticket"),
          ),
        )
        .limit(200);

      const binding = bindings.find(
        (row) => (row.data as Record<string, unknown> | null)?.paperclipIssueId === issue.id,
      );
      if (!binding) return null;

      const body = this.formatOutboundMirrorComment(issue, opts.deliverableUrl ?? undefined);

      await db
        .update(externalObjects)
        .set({
          data: {
            ...(binding.data as Record<string, unknown>),
            lastMirroredStatus: issue.status,
            lastMirroredBody: body,
            lastMirroredAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(externalObjects.id, binding.id));

      return { externalObjectId: binding.id, body };
    },
  };
}
