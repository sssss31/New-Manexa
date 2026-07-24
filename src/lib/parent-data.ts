import { prisma } from "./prisma";

export async function loadParentChildren(userId: string) {
  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: {
      children: {
        include: {
          student: {
            include: {
              user: true,
              class: true,
              section: true,
              transportAlloc: { include: { route: { include: { vehicle: true } } } },
            },
          },
        },
      },
    },
  });
  return parent?.children.map((c) => c.student) ?? [];
}
