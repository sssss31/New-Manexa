import { requireRole } from "@/lib/auth";
import { CalendarScreen } from "@/components/calendar/CalendarScreen";

export default async function Calendar({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireRole("TEACHER");
  const { month } = await searchParams;
  return (
    <CalendarScreen
      user={user}
      month={month}
      basePath="/teacher/calendar"
      title="My Calendar"
      sub="Your classes, exams, assignment deadlines, meetings and school events."
    />
  );
}
