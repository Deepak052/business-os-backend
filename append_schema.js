const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma/schema.prisma');
const schemaAdditions = `

// -----------------------------------------------------------------------------
// MODULE: HRMS
// -----------------------------------------------------------------------------

model HrmsEmployeeProfile {
  id             String       @id @default(uuid())
  organizationId String
  userId         String       
  departmentId   String?      // Links to Core Department
  jobTitle       String
  employmentType String       // full_time, part_time, contractor
  startDate      DateTime
  status         String       @default("active") // active, on_leave, terminated
  
  // Relations
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Restrict)
  department     Department?  @relation(fields: [departmentId], references: [id], onDelete: SetNull)

  attendances    HrmsAttendance[]
  leaves         HrmsLeaveRequest[]
  payrolls       HrmsPayrollStub[]
  reviews        HrmsPerformanceReview[]

  @@unique([organizationId, userId])
}

model HrmsAttendance {
  id             String       @id @default(uuid())
  organizationId String
  employeeId     String
  date           DateTime     @db.Date
  clockIn        DateTime?
  clockOut       DateTime?
  status         String       @default("present") // present, absent, late, half_day
  notes          String?
  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  employee       HrmsEmployeeProfile @relation(fields: [employeeId], references: [id], onDelete: Restrict)

  @@unique([organizationId, employeeId, date])
}

model HrmsLeaveRequest {
  id             String       @id @default(uuid())
  organizationId String
  employeeId     String
  leaveType      String       // sick, vacation, personal
  startDate      DateTime
  endDate        DateTime
  status         String       @default("pending") // pending, approved, rejected
  reason         String?
  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  employee       HrmsEmployeeProfile @relation(fields: [employeeId], references: [id], onDelete: Restrict)
}

model HrmsPayrollStub {
  id             String       @id @default(uuid())
  organizationId String
  employeeId     String
  periodStart    DateTime     @db.Date
  periodEnd      DateTime     @db.Date
  grossPay       Float
  netPay         Float
  deductions     Float
  status         String       @default("draft") // draft, paid
  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  employee       HrmsEmployeeProfile @relation(fields: [employeeId], references: [id], onDelete: Restrict)
}

model HrmsPerformanceReview {
  id             String       @id @default(uuid())
  organizationId String
  employeeId     String
  reviewerId     String       // Links to User (reviewer)
  reviewPeriod   String       // e.g. Q3 2026
  rating         Int          // 1-5 scale
  comments       String?
  status         String       @default("draft") // draft, published
  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  employee       HrmsEmployeeProfile @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  reviewer       User         @relation("ReviewerUser", fields: [reviewerId], references: [id], onDelete: Restrict)
}
`;

fs.appendFileSync(schemaPath, schemaAdditions);
console.log('Appended HRMS schema');
