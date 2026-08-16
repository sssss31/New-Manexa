import { requireRole } from "@/lib/auth";
import { CalendarScreen } from "@/components/calendar/CalendarScreen";

export default async function Calendar({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireRole("ACCOUNTANT");
  const { month } = await searchParams;
  return (
    <CalendarScreen
      user={user}
      month={month}
      basePath="/accounts/calendar"
      title="Finance Calendar"
      sub="Fee due dates, payroll periods and finance events across the institution."
    />
  );
}
