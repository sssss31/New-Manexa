// Realistic seed for MANEXA SCMS MVP.
// Golden path: platform → 3 tenants → users → classes/subjects → students & parents
// → timetable → fee structures + invoices → some payments → LMS courses/lessons/assignments
// → exams with published marks → transport → library → notices → automations.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptEmbedding } from "../src/lib/face/crypto";
import { PERMISSIONS, DEFAULT_MATRIX } from "../src/lib/permissions";

const prisma = new PrismaClient();

// Synthetic L2-normalized descriptor for seeding the face gallery. Real
// enrolments produce these from the webcam; seed vectors keep dashboards +
// reports populated without a camera. They intentionally won't match a live
// face (that's expected — enrol a real student to see a live match).
function fakeDescriptor(dim = 256): number[] {
  const v = Array.from({ length: dim }, () => Math.random() - 0.5);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

const PW = "password123";

async function hash() {
  return bcrypt.hash(PW, 10);
}

const now = new Date();
const day = 86400000;

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function daysAgo(n: number) {
  const d = new Date(now.getTime() - n * day);
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysAhead(n: number) {
  return new Date(now.getTime() + n * day);
}
function hoursAgo(n: number) {
  return new Date(now.getTime() - n * 3600_000);
}
function monthLabel(offset = 0) {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

const FIRST_NAMES = ["Aarav","Aanya","Ishaan","Kiara","Ayaan","Diya","Vivaan","Anaya","Rehan","Sara","Krish","Meera","Rohan","Anvi","Kabir","Zara","Arjun","Riya","Reyansh","Prisha","Vihaan","Myra","Aadhya","Aditya","Neha","Yash","Aisha","Aryan"];
const LAST_NAMES = ["Sharma","Verma","Iyer","Patel","Kulkarni","Menon","Reddy","Nair","Rao","Gupta","Singh","Kumar","Kapoor","Chatterjee","Bose","Das","Joshi","Desai"];
const PARENT_RELATIONS = ["FATHER", "MOTHER", "GUARDIAN"];

async function main() {
  console.log("🌱 seeding MANEXA SCMS…");
  const pw = await hash();

  // --- clear ---
  for (const t of [
    "loginEvent","rolePermission","permission","institutionCounter",
    "recognitionLog","unknownFace","faceAttendanceRecord","faceAttendanceSession","faceSample","faceProfile","attendanceDevice",
    "notification","stockMovement","inventoryItem","hostelAllocation","hostelRoom","event",
    "auditLog","automationRun","automation","libraryLoan","libraryItem","banner","subscription","subscriptionPlan",
    "transportAllocation","route","vehicle","payrollLine","payrollRun","payment","invoiceItem","invoice","feeStructure",
    "mark","exam","assignmentSubmission","assignment","lesson","course","timetableEntry","classSubject","attendance",
    "parentStudent","student","parent","staff","subject","section","class","leadActivity","lead","notice","message",
    "disciplineIncident","session","user","tenant"
  ]) {
    // @ts-ignore
    await prisma[t]?.deleteMany?.();
  }

  // ---- Plans ----
  const [starter, standard, pro, enterprise] = await Promise.all([
    prisma.subscriptionPlan.create({
      data: { code: "STARTER", name: "Starter", perStudentPrice: 15, storageGb: 10, supportLevel: "STANDARD",
        features: JSON.stringify(["SIS","Attendance","Fee","Communication","Notice","Parent App"]) },
    }),
    prisma.subscriptionPlan.create({
      data: { code: "STANDARD", name: "Standard", perStudentPrice: 30, storageGb: 25, supportLevel: "STANDARD",
        features: JSON.stringify(["Starter modules","LMS","Examination","Timetable","Reports","Activities"]) },
    }),
    prisma.subscriptionPlan.create({
      data: { code: "PRO", name: "Pro", perStudentPrice: 55, storageGb: 100, supportLevel: "PRIORITY",
        features: JSON.stringify(["Standard modules","LEAD/CRM","HR","Payroll","Transport","Library","Inventory","Health"]) },
    }),
    prisma.subscriptionPlan.create({
      data: { code: "ENTERPRISE", name: "Enterprise", perStudentPrice: 90, storageGb: 500, supportLevel: "DEDICATED",
        features: JSON.stringify(["All 28 modules","Hostel","Dedicated DB","Custom workflows","SLA"]) },
    }),
  ]);

  // ---- Super Admin ----
  const superAdmin = await prisma.user.create({
    data: { email: "super@manexa.test", displayName: "Riya Kapoor", role: "SUPER_ADMIN", passwordHash: pw },
  });

  // ---- Banners (platform-level) ----
  await prisma.banner.createMany({
    data: [
      { title: "Board results 2026 · Add-on module out", body: "Result Analytics 2.0 helps you spot bottom-quartile students in one click.", audience: "TENANT_ADMIN", impressions: 1240, clicks: 82 },
      { title: "Parent app now supports 6 languages", body: "Hindi, Tamil, Marathi, Bengali, Gujarati & Telugu — enable in Institution Settings.", audience: "PARENTS", impressions: 5420, clicks: 611 },
    ],
  });

  // ---- Permission catalog (platform-wide) ----
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: p.key }, update: { label: p.label, category: p.category }, create: p });
  }

  // ---- Tenant #1 · St. John's ----
  await seedTenant({
    name: "St. John's Academy",
    institutionId: "MAN-SCH-100001", type: "SCHOOL",
    city: "Bengaluru", state: "Karnataka",
    subdomain: "stjohns",
    code: "SJA",
    board: "CBSE",
    isolation: "POOLED",
    planId: pro.id,
    plan: pro,
    subscribeMRR: 1_57_500, // 3000 students × ₹52.5
    seats: 3000,
  }, pw);

  // ---- Tenant #2 · Delhi Public School (Pune) ----
  await seedTenant({
    name: "Delhi Public School · Pune",
    institutionId: "MAN-SCH-100002", type: "SCHOOL",
    city: "Pune", state: "Maharashtra",
    subdomain: "dpspune",
    code: "DPSP",
    board: "CBSE",
    isolation: "BRIDGE",
    planId: enterprise.id,
    plan: enterprise,
    subscribeMRR: 3_15_000,
    seats: 3500,
  }, pw);

  // ---- Tenant #3 · Bright Buds Coaching ----
  await seedTenant({
    name: "Bright Buds Coaching",
    institutionId: "MAN-COA-100001", type: "COACHING",
    city: "Jaipur", state: "Rajasthan",
    subdomain: "brightbuds",
    code: "BBC",
    board: "STATE",
    isolation: "POOLED",
    planId: standard.id,
    plan: standard,
    subscribeMRR: 24_000,
    seats: 800,
  }, pw);

  // Continue the ID counters after the seeded institutions so new signups get
  // MAN-SCH-100003 and MAN-COA-100002 next.
  await prisma.institutionCounter.upsert({ where: { type: "SCHOOL" }, update: { next: 3 }, create: { type: "SCHOOL", next: 3 } });
  await prisma.institutionCounter.upsert({ where: { type: "COACHING" }, update: { next: 2 }, create: { type: "COACHING", next: 2 } });

  await prisma.auditLog.create({
    data: { actorId: superAdmin.id, action: "PLATFORM_SEED", entity: "Platform", detail: "Seed complete · 3 tenants provisioned" },
  });

  console.log("✅ seed complete.");
  console.log("Demo logins (password: password123):");
  console.log("  super@manexa.test");
  console.log("  admin@stjohns.manexa.test / principal@stjohns.manexa.test");
  console.log("  teacher@stjohns.manexa.test / accountant@stjohns.manexa.test");
  console.log("  parent@stjohns.manexa.test / student@stjohns.manexa.test");
}

async function seedTenant(spec: {
  name: string; institutionId: string; type: string; city: string; state: string;
  subdomain: string; code: string; board: string;
  isolation: string; planId: string; plan: any;
  subscribeMRR: number; seats: number;
}, pw: string) {
  console.log(`  ↳ tenant: ${spec.name} (${spec.institutionId})`);
  const t = await prisma.tenant.create({
    data: {
      name: spec.name, institutionId: spec.institutionId, type: spec.type,
      city: spec.city, state: spec.state, country: "India",
      academicYear: `${now.getFullYear()}-${now.getFullYear() + 1}`,
      subscriptionExpiry: new Date(now.getTime() + 300 * day),
      subdomain: spec.subdomain, code: spec.code, board: spec.board,
      isolation: spec.isolation, planId: spec.planId, status: "ACTIVE",
    },
  });

  // DB-driven RBAC grants for this tenant, from the default matrix.
  await prisma.rolePermission.createMany({
    data: Object.entries(DEFAULT_MATRIX).flatMap(([role, keys]) =>
      keys.map((permissionKey) => ({ tenantId: t.id, role, permissionKey, allowed: true }))
    ),
    skipDuplicates: true,
  });

  await prisma.subscription.create({
    data: {
      tenantId: t.id, planId: spec.planId,
      studentSeats: spec.seats, mrr: spec.subscribeMRR, status: "ACTIVE",
      renewsAt: new Date(now.getTime() + 300 * day),
    },
  });

  // ---- Users ----
  const admin = await prisma.user.create({ data: { email: `admin@${spec.subdomain}.manexa.test`, displayName: "Neha Kulkarni", role: "INSTITUTION_ADMIN", passwordHash: pw, tenantId: t.id, phone: "+919812345001", emailVerifiedAt: now } });
  await prisma.tenant.update({ where: { id: t.id }, data: { ownerId: admin.id } });
  const principal = await prisma.user.create({ data: { email: `principal@${spec.subdomain}.manexa.test`, displayName: "Dr. Anand Rao", role: "PRINCIPAL", passwordHash: pw, tenantId: t.id, phone: "+919812345002" } });
  const accountant = await prisma.user.create({ data: { email: `accountant@${spec.subdomain}.manexa.test`, displayName: "Ramesh Iyer", role: "ACCOUNTANT", passwordHash: pw, tenantId: t.id, phone: "+919812345003" } });
  const teacherU = await prisma.user.create({ data: { email: `teacher@${spec.subdomain}.manexa.test`, displayName: "Priya Sharma", role: "TEACHER", passwordHash: pw, tenantId: t.id, phone: "+919812345004" } });
  const teacher2 = await prisma.user.create({ data: { email: `arjun.teacher@${spec.subdomain}.manexa.test`, displayName: "Arjun Menon", role: "TEACHER", passwordHash: pw, tenantId: t.id } });
  const teacher3 = await prisma.user.create({ data: { email: `kavita.teacher@${spec.subdomain}.manexa.test`, displayName: "Kavita Verma", role: "TEACHER", passwordHash: pw, tenantId: t.id } });

  const teacher = await prisma.staff.create({ data: { tenantId: t.id, userId: teacherU.id, employeeCode: "T-001", designation: "Class Teacher · Math", department: "Mathematics", ctcMonthly: 62000 } });
  await prisma.staff.create({ data: { tenantId: t.id, userId: teacher2.id, employeeCode: "T-002", designation: "Science HOD", department: "Science", ctcMonthly: 78000 } });
  await prisma.staff.create({ data: { tenantId: t.id, userId: teacher3.id, employeeCode: "T-003", designation: "English Teacher", department: "Languages", ctcMonthly: 55000 } });
  await prisma.staff.create({ data: { tenantId: t.id, userId: accountant.id, employeeCode: "A-001", designation: "Accountant", department: "Finance", ctcMonthly: 48000 } });

  // ---- Classes & Sections ----
  const classNames = ["Class VI", "Class VII", "Class VIII", "Class IX", "Class X"];
  const classes = [];
  for (const cn of classNames) {
    const cls = await prisma.class.create({ data: { tenantId: t.id, name: cn } });
    for (const sec of ["A", "B"]) {
      await prisma.section.create({ data: { tenantId: t.id, classId: cls.id, name: sec, capacity: 40 } });
    }
    classes.push(cls);
  }

  // ---- Subjects ----
  const SUBJECTS = [
    { code: "MATH", name: "Mathematics" },
    { code: "SCI",  name: "Science" },
    { code: "ENG",  name: "English" },
    { code: "SST",  name: "Social Studies" },
    { code: "HIN",  name: "Hindi" },
    { code: "CS",   name: "Computer Science" },
  ];
  const subjects = [];
  for (const s of SUBJECTS) {
    const sub = await prisma.subject.create({ data: { tenantId: t.id, ...s } });
    subjects.push(sub);
  }

  // ---- Timetable · for first class first section ----
  const cls6 = classes[0];
  const sec6a = (await prisma.section.findFirst({ where: { classId: cls6.id, name: "A" } }))!;
  for (let day = 1; day <= 5; day++) {
    for (let period = 1; period <= 6; period++) {
      const subj = subjects[(day + period) % subjects.length];
      await prisma.timetableEntry.create({
        data: {
          tenantId: t.id, classId: cls6.id, sectionId: sec6a.id, subjectId: subj.id,
          teacherId: teacher.id, dayOfWeek: day, period, room: `${100 + period}`,
        },
      });
    }
  }

  // ---- Students & Parents ----
  const parentU = await prisma.user.create({ data: { email: `parent@${spec.subdomain}.manexa.test`, displayName: "Ravi & Meena Sharma", role: "PARENT", passwordHash: pw, tenantId: t.id, phone: "+919810000001" } });
  const parent = await prisma.parent.create({ data: { tenantId: t.id, userId: parentU.id, relation: "FATHER", occupation: "Software Engineer" } });

  const studentU = await prisma.user.create({ data: { email: `student@${spec.subdomain}.manexa.test`, displayName: "Aarav Sharma", role: "STUDENT", passwordHash: pw, tenantId: t.id } });
  const primaryStudent = await prisma.student.create({
    data: {
      tenantId: t.id, userId: studentU.id, admissionNo: `${new Date().getFullYear()}/0001`,
      rollNo: "1", classId: cls6.id, sectionId: sec6a.id, bloodGroup: "B+", gender: "M", category: "GENERAL", status: "ACTIVE",
      dateOfBirth: new Date(2013, 4, 12),
    },
  });
  await prisma.parentStudent.create({ data: { parentId: parent.id, studentId: primaryStudent.id, isPrimary: true } });

  // Populate ~25 more students in Class VI A + spread across other sections
  const secList = await prisma.section.findMany({ where: { tenantId: t.id }, include: { class: true } });
  const students = [primaryStudent];
  for (let i = 2; i <= 60; i++) {
    const fname = rand(FIRST_NAMES);
    const lname = rand(LAST_NAMES);
    const full = `${fname} ${lname}`;
    const sec = rand(secList);
    const email = `${full.toLowerCase().replace(/[^a-z]+/g, ".")}.${i}@student.${spec.subdomain}.test`;
    const uS = await prisma.user.create({ data: { email, displayName: full, role: "STUDENT", passwordHash: pw, tenantId: t.id } });
    const parentEmail = `parent.${i}@family.${spec.subdomain}.test`;
    const uP = await prisma.user.create({
      data: {
        email: parentEmail, displayName: `${rand(["Mr.","Mrs.","Dr."])} ${lname}`,
        role: "PARENT", passwordHash: pw, tenantId: t.id,
        phone: `+9198${String(10000000 + i).slice(0, 8)}`,
      },
    });
    const p = await prisma.parent.create({ data: { tenantId: t.id, userId: uP.id, relation: rand(PARENT_RELATIONS) } });
    const s = await prisma.student.create({
      data: {
        tenantId: t.id, userId: uS.id,
        admissionNo: `${new Date().getFullYear()}/${String(i).padStart(4, "0")}`,
        rollNo: String(i),
        classId: sec.classId, sectionId: sec.id,
        bloodGroup: rand(["A+","B+","O+","AB+","O-","A-"]),
        gender: rand(["M","F"]),
        category: rand(["GENERAL","GENERAL","OBC","SC"]),
        status: "ACTIVE",
        dateOfBirth: new Date(now.getFullYear() - 12 + Math.floor(i / 10), i % 12, (i * 3) % 27 + 1),
      },
    });
    await prisma.parentStudent.create({ data: { parentId: p.id, studentId: s.id, isPrimary: true } });
    students.push(s);
  }

  // ---- Fee Structures ----
  const feeStructures = [];
  for (const c of classes) {
    const fs = await prisma.feeStructure.create({
      data: {
        tenantId: t.id, classId: c.id, name: "Annual regular",
        tuition: 4500 + classes.indexOf(c) * 250,
        transport: 1200,
        lab: 300, activity: 400, exam: 250, misc: 150,
        frequency: "MONTHLY",
      },
    });
    feeStructures.push(fs);
  }

  // ---- Invoices — 3 months back for all students ----
  const structureByClass = new Map(feeStructures.map((s) => [s.classId, s]));
  let invNum = 1;
  for (const s of students) {
    const st = structureByClass.get(s.classId)!;
    for (let m = 2; m >= 0; m--) {
      const label = monthLabel(-m);
      const items = [
        { head: "Tuition", amount: st.tuition },
        { head: "Transport", amount: st.transport },
        { head: "Lab", amount: st.lab },
        { head: "Activity", amount: st.activity },
      ].filter((x) => x.amount > 0);
      const subtotal = items.reduce((s2, i) => s2 + i.amount, 0);
      const paid = m > 0 || Math.random() < 0.7;
      const dueDate = m === 0 ? daysAhead(5) : daysAgo(m * 30 - 5);
      const inv = await prisma.invoice.create({
        data: {
          tenantId: t.id, studentId: s.id,
          number: `INV-${new Date().getFullYear()}-${String(invNum++).padStart(5, "0")}`,
          periodLabel: label,
          issueDate: daysAgo(m * 30 + 5),
          dueDate,
          subtotal, total: subtotal,
          status: paid ? "PAID" : m === 0 ? "DUE" : "OVERDUE",
          paidAt: paid ? daysAgo(m * 30 + 2) : null,
          items: { create: items },
        },
      });
      if (paid) {
        await prisma.payment.create({
          data: {
            invoiceId: inv.id, amount: subtotal,
            method: rand(["UPI","UPI","CARD","NETBANKING","CASH"]),
            reference: `pay_${Math.random().toString(36).slice(2, 10)}`,
            paidAt: daysAgo(m * 30 + 2),
          },
        });
      }
    }
  }

  // ---- Attendance last 20 school days for Class VI A ----
  const cls6A = students.filter((s) => s.sectionId === sec6a.id);
  for (let d = 20; d >= 1; d--) {
    const date = daysAgo(d);
    if (date.getDay() === 0) continue; // skip Sunday
    for (const s of cls6A) {
      const roll = Math.random();
      const status = roll < 0.9 ? "PRESENT" : roll < 0.96 ? "LATE" : "ABSENT";
      await prisma.attendance.create({
        data: { tenantId: t.id, studentId: s.id, date, status, markedBy: teacherU.id },
      });
    }
  }

  // ---- LMS courses ----
  const mathCourse = await prisma.course.create({
    data: {
      tenantId: t.id, subjectId: subjects[0].id, teacherId: teacherU.id,
      title: "Algebra Foundations · Class VI",
      summary: "Introduction to algebraic expressions and equations.",
      publishedAt: daysAgo(14),
      lessons: {
        create: [
          { order: 1, title: "Variables and Constants", body: "A variable represents an unknown quantity. e.g., x, y. A constant has a fixed value like 3, 7.", minutes: 20 },
          { order: 2, title: "Algebraic Expressions", body: "Combinations of variables, constants and operators. e.g., 3x + 5.", minutes: 25 },
          { order: 3, title: "Simple Equations", body: "Solving one-variable linear equations by isolation.", minutes: 30 },
        ],
      },
    },
  });
  const engCourse = await prisma.course.create({
    data: {
      tenantId: t.id, subjectId: subjects[2].id, teacherId: teacher3.id,
      title: "Reading Comprehension · Class VI",
      summary: "Building the habit of active reading.",
      publishedAt: daysAgo(10),
      lessons: {
        create: [
          { order: 1, title: "Skimming vs Scanning", body: "Two distinct reading strategies.", minutes: 20 },
          { order: 2, title: "Inferring meaning from context", body: "You do not always need a dictionary.", minutes: 25 },
        ],
      },
    },
  });

  // Assignments + submissions
  const a1 = await prisma.assignment.create({
    data: {
      courseId: mathCourse.id, title: "Homework 1 · Expressions",
      instructions: "Simplify each expression and write the answer.",
      dueAt: daysAhead(2), maxScore: 20,
    },
  });
  const a2 = await prisma.assignment.create({
    data: {
      courseId: mathCourse.id, title: "Weekly Quiz · Simple Equations",
      instructions: "Solve for x in each of the 10 questions.",
      dueAt: daysAgo(3), maxScore: 20,
    },
  });
  await prisma.assignmentSubmission.create({
    data: {
      assignmentId: a2.id, studentId: primaryStudent.id,
      content: "1) x=3, 2) x=-4, 3) x=7 …", score: 18, feedback: "Great work — watch signs in Q4.",
    },
  });
  // Ungraded submissions from a handful of students
  for (const s of cls6A.slice(0, 5)) {
    await prisma.assignmentSubmission.create({
      data: {
        assignmentId: a1.id, studentId: s.id,
        content: "Attached solutions in PDF (link).",
      },
    });
  }

  // ---- Exams + marks (one published, one scheduled) ----
  const exam1 = await prisma.exam.create({
    data: {
      tenantId: t.id, classId: cls6.id, subjectId: subjects[0].id,
      title: "FA1 · Mathematics", type: "FA",
      scheduledAt: daysAgo(15), maxScore: 50, status: "PUBLISHED",
    },
  });
  for (const s of cls6A) {
    await prisma.mark.create({
      data: { examId: exam1.id, studentId: s.id, score: randInt(28, 48) },
    });
  }
  await prisma.exam.create({
    data: {
      tenantId: t.id, classId: cls6.id, subjectId: subjects[1].id,
      title: "SA1 · Science", type: "SA",
      scheduledAt: daysAhead(12), maxScore: 100, status: "SCHEDULED",
    },
  });

  // ---- Transport ----
  const v1 = await prisma.vehicle.create({
    data: {
      tenantId: t.id, registration: `MH12-AB-${randInt(1000, 9999)}`, capacity: 45,
      driverName: "Suresh Kumar", driverPhone: "+919812311111",
      insuranceExpiry: daysAhead(200), fitnessExpiry: daysAhead(160),
    },
  });
  const route1 = await prisma.route.create({
    data: {
      tenantId: t.id, name: "Route 5 · Kothrud", vehicleId: v1.id, monthlyFare: 1200,
      stops: JSON.stringify([
        { name: "Kothrud Depot", pickupTime: "07:00", dropTime: "16:30" },
        { name: "Karve Road", pickupTime: "07:12", dropTime: "16:20" },
        { name: "Deccan Corner", pickupTime: "07:25", dropTime: "16:05" },
      ]),
    },
  });
  await prisma.transportAllocation.create({
    data: { studentId: primaryStudent.id, routeId: route1.id, stopName: "Kothrud Depot" },
  });
  const v2 = await prisma.vehicle.create({
    data: {
      tenantId: t.id, registration: `MH12-CD-${randInt(1000, 9999)}`, capacity: 40,
      driverName: "Mohan Verma", driverPhone: "+919812322222",
    },
  });
  await prisma.route.create({
    data: {
      tenantId: t.id, name: "Route 3 · Aundh", vehicleId: v2.id, monthlyFare: 1350,
      stops: JSON.stringify([
        { name: "Aundh Chowk", pickupTime: "07:05", dropTime: "16:35" },
        { name: "Baner Square", pickupTime: "07:20", dropTime: "16:20" },
      ]),
    },
  });

  // ---- Library ----
  const books = [
    { title: "Wings of Fire", author: "APJ Abdul Kalam", copies: 3 },
    { title: "The Wonder That Was India", author: "AL Basham", copies: 2 },
    { title: "Panchatantra", author: "Vishnu Sharma", copies: 4 },
    { title: "Bharat: A People's History", author: "K M Panikkar", copies: 2 },
    { title: "NCERT Mathematics · Class VI", author: "NCERT", copies: 10 },
    { title: "The Discovery of India", author: "J L Nehru", copies: 3 },
  ];
  for (const b of books) {
    const item = await prisma.libraryItem.create({
      data: { tenantId: t.id, ...b, available: b.copies, category: "General" },
    });
    // one loan for the primary student
    if (b.title === "Wings of Fire") {
      await prisma.libraryLoan.create({
        data: { itemId: item.id, studentId: primaryStudent.id, dueAt: daysAhead(6) },
      });
      await prisma.libraryItem.update({ where: { id: item.id }, data: { available: b.copies - 1 } });
    }
  }

  // ---- Notices ----
  await prisma.notice.createMany({
    data: [
      { tenantId: t.id, title: "PTM this Saturday", body: "Parent–teacher meeting on Saturday 10 AM. Please confirm attendance in the parent app.", audience: "PARENTS", authorId: principal.id, publishedAt: daysAgo(3) },
      { tenantId: t.id, title: "Fee reminder · Aug 2026", body: "August fees are due by the 10th. Please pay online to avoid late fees.", audience: "PARENTS", authorId: accountant.id, publishedAt: daysAgo(1) },
      { tenantId: t.id, title: "Science exhibition · Registrations open", body: "Grade VI-VIII students can register at the office. Team of 2-3.", audience: "ALL", authorId: principal.id, publishedAt: daysAgo(6) },
      { tenantId: t.id, title: "Independence Day rehearsal", body: "All classes to remain on campus till 4 PM on the 14th.", audience: "STAFF", authorId: admin.id, publishedAt: daysAgo(8) },
    ],
  });

  // ---- LEADs ----
  const stageDist = ["NEW","CONTACTED","VISIT_SCHEDULED","VISITED","APPLICATION","CONFIRMED","LOST"];
  for (let i = 0; i < 18; i++) {
    const stage = i < stageDist.length ? stageDist[i] : rand(stageDist);
    const fname = rand(FIRST_NAMES);
    const lname = rand(LAST_NAMES);
    await prisma.lead.create({
      data: {
        tenantId: t.id,
        parentName: `${rand(["Mr.","Mrs.","Dr."])} ${lname}`,
        studentName: `${fname} ${lname}`,
        gradeInterest: rand(classNames),
        phone: `+9199${String(10000000 + i).slice(0, 8)}`,
        email: i % 3 === 0 ? `${fname.toLowerCase()}.${lname.toLowerCase()}@parent.test` : null,
        source: rand(["WEBSITE","WALKIN","REFERRAL","ADS","WHATSAPP"]),
        stage,
        score: randInt(30, 95),
        createdAt: daysAgo(randInt(1, 25)),
      },
    });
  }

  // ---- Automations ----
  const autos = [
    { name: "Absent → parent SMS in 15 min", eventType: "attendance.absent", action: "SEND_SMS", condition: "Any absence without prior leave" },
    { name: "Fee paid → thank-you WhatsApp", eventType: "fee.invoice.paid", action: "SEND_WHATSAPP", condition: "Immediately on payment" },
    { name: "Fee overdue → follow-up SMS", eventType: "fee.invoice.overdue", action: "SEND_SMS", condition: "Days past due ≥ 3" },
    { name: "Result published → notify parent", eventType: "exam.result.published", action: "SEND_SMS", condition: "Any exam" },
    { name: "New lead → welcome SMS", eventType: "lead.new", action: "SEND_SMS" },
  ];
  for (const a of autos) {
    await prisma.automation.create({ data: { tenantId: t.id, trigger: "EVENT", ...a } });
  }

  // ---- Hostel ----
  const roomIds: string[] = [];
  for (const block of ["A", "B"]) {
    for (let n = 101; n <= 103; n++) {
      const room = await prisma.hostelRoom.create({
        data: { tenantId: t.id, block, number: String(n), capacity: 4, type: n === 101 ? "AC" : "NON_AC" },
      });
      roomIds.push(room.id);
    }
  }
  const boarders = students.slice(5, 13);
  for (let i = 0; i < boarders.length; i++) {
    await prisma.hostelAllocation.create({
      data: { roomId: roomIds[i % roomIds.length], studentId: boarders[i].id },
    });
  }

  // ---- Inventory ----
  const invItems = [
    { name: "Whiteboard markers (box)", category: "Classroom", quantity: 24, reorderLevel: 10, unitCost: 240 },
    { name: "A4 paper reams", category: "Office", quantity: 8, reorderLevel: 12, unitCost: 320 },
    { name: "Basketball", category: "Sports", quantity: 6, reorderLevel: 3, unitCost: 850 },
    { name: "Microscope slides (pack)", category: "Lab", quantity: 4, reorderLevel: 6, unitCost: 180 },
    { name: "Projector lamps", category: "AV", quantity: 3, reorderLevel: 2, unitCost: 4200 },
    { name: "First-aid kits", category: "Medical", quantity: 12, reorderLevel: 5, unitCost: 650 },
  ];
  for (const item of invItems) {
    const created = await prisma.inventoryItem.create({ data: { tenantId: t.id, ...item } });
    await prisma.stockMovement.create({
      data: { itemId: created.id, delta: item.quantity, reason: "opening stock" },
    });
  }

  // ---- Events ----
  await prisma.event.createMany({
    data: [
      { tenantId: t.id, title: "Parent–Teacher Meeting", description: "Term 1 progress discussion — slots via the parent app.", venue: "Respective classrooms", audience: "PARENTS", startsAt: daysAhead(4) },
      { tenantId: t.id, title: "Science Exhibition", description: "Inter-house science fair. Teams of 2-3 from grades VI-VIII.", venue: "Main hall", audience: "ALL", startsAt: daysAhead(15) },
      { tenantId: t.id, title: "Independence Day Assembly", venue: "School grounds", audience: "ALL", startsAt: daysAgo(2) },
    ],
  });

  // ---- Notifications for the demo parent ----
  await prisma.notification.createMany({
    data: [
      { tenantId: t.id, userId: parentU.id, kind: "fee", title: "Payment received — ₹6,400", body: "Invoice settled. Receipt available in Fees & payments.", href: "/parent/fees", readAt: daysAgo(1) },
      { tenantId: t.id, userId: parentU.id, kind: "attendance", title: "Aarav marked late", body: "Arrived 12 minutes after the bell on Tuesday.", href: "/parent/attendance" },
      { tenantId: t.id, role: "PARENT", kind: "notice", title: "PTM this Saturday", body: "Parent–teacher meeting on Saturday 10 AM. Confirm attendance in the app." },
    ],
  });

  // ---- AI Face Attendance ----
  const devices = await Promise.all([
    prisma.attendanceDevice.create({ data: { tenantId: t.id, name: "Class VI-A Camera", kind: "WEBCAM", location: "Block A · Room 101", status: "ONLINE", lastSeenAt: new Date() } }),
    prisma.attendanceDevice.create({ data: { tenantId: t.id, name: "Main Gate CCTV", kind: "CCTV", location: "Entrance", status: "ONLINE", lastSeenAt: hoursAgo(1) } }),
    prisma.attendanceDevice.create({ data: { tenantId: t.id, name: "Reception iPad", kind: "EXTERNAL", location: "Front office", status: "OFFLINE", lastSeenAt: daysAgo(1) } }),
  ]);

  // Enrol ~60% of Class VI-A with FRONT + NEUTRAL synthetic samples.
  const enrolTargets = cls6A.slice(0, Math.ceil(cls6A.length * 0.6));
  for (const s of enrolTargets) {
    const profile = await prisma.faceProfile.create({
      data: { tenantId: t.id, subjectType: "STUDENT", studentId: s.id, sampleCount: 2, avgQuality: 78 + Math.floor(Math.random() * 15) },
    });
    for (const pose of ["FRONT", "NEUTRAL"] as const) {
      await prisma.faceSample.create({
        data: {
          profileId: profile.id, pose, dim: 256, embedding: encryptEmbedding(fakeDescriptor()),
          quality: 78 + Math.floor(Math.random() * 15), brightness: 130, sharpness: 30, version: 1,
        },
      });
    }
  }
  // Enrol the demo teacher too (staff face).
  const teacherProfile = await prisma.faceProfile.create({
    data: { tenantId: t.id, subjectType: "STAFF", staffId: teacher.id, sampleCount: 3, avgQuality: 84 },
  });
  for (const pose of ["FRONT", "LEFT30", "RIGHT30"] as const) {
    await prisma.faceSample.create({
      data: { profileId: teacherProfile.id, pose, dim: 256, embedding: encryptEmbedding(fakeDescriptor()), quality: 84, brightness: 128, sharpness: 33, version: 1 },
    });
  }

  // A closed morning session with attendance records + recognition logs.
  const session = await prisma.faceAttendanceSession.create({
    data: {
      tenantId: t.id, classId: cls6.id, sectionId: sec6a.id, subjectId: subjects[0].id,
      period: 1, teacherId: teacherU.id, deviceId: devices[0].id, status: "CLOSED",
      startedAt: hoursAgo(5), endedAt: hoursAgo(4), threshold: 88, lateAfterMin: 10,
    },
  });
  for (let i = 0; i < enrolTargets.length; i++) {
    const s = enrolTargets[i];
    const late = i % 7 === 0;
    const conf = 90 + Math.floor(Math.random() * 9);
    await prisma.faceAttendanceRecord.create({
      data: {
        sessionId: session.id, studentId: s.id, status: late ? "LATE" : "PRESENT",
        confidence: conf, recognizedAt: new Date(hoursAgo(5).getTime() + i * 45000),
        deviceInfo: "Chrome · Class VI-A Camera",
      },
    });
    await prisma.recognitionLog.create({
      data: { tenantId: t.id, sessionId: session.id, matchedStudentId: s.id, decision: "RECOGNIZED", confidence: conf, latencyMs: 180 + Math.floor(Math.random() * 90), livenessScore: 70 + Math.floor(Math.random() * 25), at: new Date(hoursAgo(5).getTime() + i * 45000) },
    });
  }
  // A few non-recognition decisions for realistic dashboard stats.
  await prisma.recognitionLog.createMany({
    data: [
      { tenantId: t.id, sessionId: session.id, decision: "UNKNOWN", confidence: 61, latencyMs: 210, livenessScore: 72, at: hoursAgo(4) },
      { tenantId: t.id, sessionId: session.id, decision: "LOW_CONFIDENCE", confidence: 84, latencyMs: 195, livenessScore: 68, at: hoursAgo(4) },
      { tenantId: t.id, sessionId: session.id, decision: "SPOOF_REJECTED", confidence: 0, latencyMs: 120, livenessScore: 18, at: hoursAgo(4) },
      { tenantId: t.id, sessionId: session.id, decision: "QUALITY_REJECTED", confidence: 0, latencyMs: 90, livenessScore: 0, at: hoursAgo(4) },
    ],
  });
  await prisma.unknownFace.createMany({
    data: [
      { tenantId: t.id, sessionId: session.id, embedding: encryptEmbedding(fakeDescriptor()), dim: 256, bestScore: 61, resolved: false, seenAt: hoursAgo(4) },
      { tenantId: t.id, sessionId: session.id, embedding: encryptEmbedding(fakeDescriptor()), dim: 256, bestScore: 55, resolved: false, seenAt: hoursAgo(3) },
    ],
  });

  // ---- Some audit trail entries so /audit isn't empty on new tenants ----
  await prisma.auditLog.createMany({
    data: [
      { tenantId: t.id, actorId: admin.id, action: "TENANT_ONBOARD", entity: "Tenant", entityId: t.id, detail: `${spec.name} · ${spec.isolation}` },
      { tenantId: t.id, actorId: admin.id, action: "PLAN_ATTACH", entity: "Tenant", entityId: t.id, detail: spec.plan.name },
      { tenantId: t.id, actorId: principal.id, action: "MASTER_DATA_SEED", entity: "Class", detail: `${classes.length} classes provisioned` },
      { tenantId: t.id, actorId: accountant.id, action: "FEE_STRUCTURE_CREATE", entity: "FeeStructure", detail: "Monthly structures for all classes" },
    ],
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
