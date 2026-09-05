import { describe, expect, it } from "vitest";
import { validateMealEnrollment } from "@/lib/meal-enrollment";

describe("individual meal enrollment validation", () => {
  it("validates a parent registering a school child", () => {
    const result = validateMealEnrollment({ parent_name: "Anita", parent_phone: "9876543210", child_name: "Nila", grade: "6", consent: "on" }, "school_child");
    expect(result.data?.fields).toMatchObject({ parent_name: "Anita", child_name: "Nila", grade: "6" });
  });

  it("requires the child's name and grade", () => {
    const result = validateMealEnrollment({ parent_name: "Anita", parent_phone: "9876543210", consent: "on" }, "school_child");
    expect(result.error).toMatch(/child/i);
  });

  it("validates a college student with course and year", () => {
    const result = validateMealEnrollment({ student_name: "Rahul", student_phone: "9876543210", course_name: "B.Com", study_year: "2", consent: true }, "college_student");
    expect(result.data?.personName).toBe("Rahul");
  });

  it("requires an office worker mobile number", () => {
    const result = validateMealEnrollment({ employee_name: "Ravi", employee_phone: "123", consent: true }, "office_worker");
    expect(result.error).toMatch(/mobile/i);
  });

  it("requires consent for every individual enrollment", () => {
    const result = validateMealEnrollment({ employee_name: "Ravi", employee_phone: "9876543210" }, "office_worker");
    expect(result.error).toMatch(/confirm/i);
  });
});
