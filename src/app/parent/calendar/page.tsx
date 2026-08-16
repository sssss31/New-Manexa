import { requireRole } from "@/lib/auth";
import { CalendarScreen } from "@/components/calendar/CalendarScreen";

export default async function Calendar({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireRole("PARENT");
  const { month } = await searchParams;
  return (
    <CalendarScreen
      user={user}
      month={month}
      basePath="/parent/calendar"
      title="Calendar"
      sub="Your child's exams, fee due dates and school events."
    />
  );
}
