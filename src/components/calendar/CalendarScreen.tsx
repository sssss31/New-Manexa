import type { ReactNode } from "react";
import { getCalendarItems, shapeForView, monthRange, istToday } from "@/lib/calendar";
import { CalendarView } from "./CalendarView";
import { PageHeader } from "@/components/ui";

/**
 * Server-side calendar screen. Resolves the month range, aggregates the real
 * tenant/role-scoped items, and hands the shaped data to the client renderer.
 * Every role page reuses this — the scoping lives in getCalendarItems.
 */
export async function CalendarScreen({
  user,
  month,
  basePath,
  title,
  sub,
  actions,
}: {
  user: { id: string; role: string; tenantId: string | null };
  month?: string;
  basePath: string;
  title: string;
  sub: string;
  actions?: ReactNode;
}) {
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : istToday().slice(0, 7);
  const { from, to, year, monthIndex } = monthRange(m);
  const items = await getCalendarItems({ tenantId: user.tenantId!, from, to, role: user.role, userId: user.id });
  const view = shapeForView(items);

  return (
    <>
      <PageHeader title={title} sub={sub} actions={actions} />
      <CalendarView items={view} year={year} monthIndex={monthIndex} today={istToday()} basePath={basePath} />
    </>
  );
}
