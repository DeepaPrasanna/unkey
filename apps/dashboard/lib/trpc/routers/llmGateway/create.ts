import { db, schema } from "@/lib/db";
import { ingestAuditLogs } from "@/lib/tinybird";
import { rateLimitedProcedure, ratelimit } from "@/lib/trpc/ratelimitProcedure";
import { DatabaseError } from "@planetscale/database";
import { TRPCError } from "@trpc/server";
import { newId } from "@unkey/id";
import { z } from "zod";

export const createLlmGateway = rateLimitedProcedure(ratelimit.create)
  .input(
    z.object({
      subdomain: z.string().min(1).max(50),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const ws = await db.query.workspaces
      .findFirst({
        where: (table, { and, eq, isNull }) =>
          and(eq(table.tenantId, ctx.tenant.id), isNull(table.deletedAt)),
      })
      .catch((_err) => {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "We were unable to create LLM gateway. Please contact support using support@unkey.dev",
        });
      });
    if (!ws) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message:
          "We are unable to find the correct workspace. Please contact support using support@unkey.dev.",
      });
    }

    const llmGatewayId = newId("llmGateway");

    await db
      .insert(schema.llmGateways)
      .values({
        id: llmGatewayId,
        subdomain: input.subdomain,
        name: input.subdomain,
        workspaceId: ws.id,
      })
      .catch((err) => {
        if (err instanceof DatabaseError && err.body.message.includes("Duplicate entry")) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Gateway subdomains must have unique names. Please try a different subdomain. <br/> If you believe this is an error and the subdomain should not be in use already, please contact support at support@unkey.dev",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to create gateway, please contact support at support@unkey.dev",
        });
      });

    await ingestAuditLogs({
      workspaceId: ws.id,
      actor: {
        type: "user",
        id: ctx.user.id,
      },
      event: "llmGateway.create",
      description: `Created ${llmGatewayId}`,
      resources: [
        {
          type: "gateway",
          id: llmGatewayId,
        },
      ],
      context: {
        location: ctx.audit.location,
        userAgent: ctx.audit.userAgent,
      },
    });

    return {
      id: llmGatewayId,
    };
  });
