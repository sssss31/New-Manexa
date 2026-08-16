import { prisma } from "./prisma";

export async function audit(args: {
  tenantId?: string | null;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: string;
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: args.tenantId ?? null,
      actorId: args.actorId ?? null,
      action: args.action,
      entity: args.entity,
      entityId: args.entityId ?? null,
      detail: args.detail ?? null,
    },
  });
}
