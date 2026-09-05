import { describe, expect, it } from "vitest";
import { normalizeMealEnrollment, normalizeMealEnrollmentStatus } from "@/lib/meal-enrollment-admin";

describe("meal enrollment administration", () => {
  it("normalizes a child enrollment", () => {
    expect(normalizeMealEnrollment("SR-12345678", { registration_type: "SCHOOL_CHILD", child_name: "Nila", parent_name: "Anita", parent_phone: "9876543210", school_name: "Sample School", grade: "6", status: "under review" })).toMatchObject({ personName: "Nila", guardianName: "Anita", contactPhone: "9876543210", locationName: "Sample School", gradeOrCourse: "6", status: "UNDER_REVIEW" });
  });
  it("normalizes college and office identifiers", () => {
    expect(normalizeMealEnrollment("COL-1", { registration_type: "COLLEGE_STUDENT", student_name: "Ravi", course_name: "B.Com", student_id: "22A" }).identifier).toBe("22A");
    expect(normalizeMealEnrollment("EMP-1", { registration_type: "OFFICE_WORKER", employee_name: "Devi", department: "Finance", employee_id: "E9" }).gradeOrCourse).toBe("Finance");
  });
  it("defaults unknown statuses safely", () => expect(normalizeMealEnrollmentStatus("unknown")).toBe("RECEIVED"));
});
