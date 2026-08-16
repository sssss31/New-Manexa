import { requireRole } from "@/lib/auth";
import { SectionCard } from "@/components/ui";
import { CalendarScreen } from "@/components/calendar/CalendarScreen";
import { createEventAction } from "../actions";

export default async function InstitutionCalendar({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "PRINCIPAL"]);
  const { month } = await searchParams;

  return (
    <>
      <CalendarScreen
        user={user}
        month={month}
        basePath="/institution/calendar"
        title="Institution Calendar"
        sub="One source of truth — events, holidays, exams, assignment deadlines and fee due dates for your institution."
      />

      {/* Quick action — creates a real Event (also drives holidays/meetings). */}
      <SectionCard title="Add to calendar" className="mt-4">
        <form action={createEventAction} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <label className="md:col-span-2"><span className="label">Title</span><input name="title" required className="input" placeholder="Parent–teacher meeting" /></label>
          <label><span className="label">Category</span>
            <select name="category" className="select">
              <option value="EVENT">Event</option><option value="HOLIDAY">Holiday</option><option value="MEETING">Meeting</option>
              <option value="ADMISSION">Admission</option><option value="ACTIVITY">Activity</option><option value="TRAINING">Training</option>
            </select>
          </label>
          <label><span className="label">Audience</span>
            <select name="audience" className="select">
              <option value="ALL">Everyone</option><option value="STAFF">Staff</option><option value="PARENTS">Parents</option><option value="STUDENTS">Students</option>
            </select>
          </label>
          <label><span className="label">When</span><input name="startsAt" type="datetime-local" required className="input" /></label>
          <button className="btn-primary">Add</button>
          <label className="md:col-span-6"><span className="label">Venue (optional)</span><input name="venue" className="input" placeholder="Auditorium" /></label>
        </form>
      </SectionCard>
    </>
  );
}
