import { requireRole } from "@/lib/auth";
import { CalendarScreen } from "@/components/calendar/CalendarScreen";

export default async function Calendar({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireRole("STUDENT");
  const { month } = await searchParams;
  return (
    <CalendarScreen
      user={user}
      month={month}
      basePath="/student/calendar"
      title="My Calendar"
      sub="Your exams, assignment deadlines and school events."
    />
  );
}
