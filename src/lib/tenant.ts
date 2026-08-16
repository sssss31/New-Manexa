import { prisma } from "./prisma";

// Resolve which tenant a user is scoped to. Super Admin has no tenant.
export async function tenantForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.tenantId) return null;
  return prisma.tenant.findUnique({ where: { id: user.tenantId } });
}
