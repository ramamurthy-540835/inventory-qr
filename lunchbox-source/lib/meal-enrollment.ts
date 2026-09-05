export type MealEnrollmentProfile = "school_child" | "college_student" | "office_worker";

export type MealEnrollmentIntake = {
  personName: string;
  contactPhone: string;
  contactEmail: string | null;
  fields: Record<string, string | number | boolean | null>;
};

function text(body: Record<string, unknown>, key: string, max: number) {
  return typeof body[key] === "string" ? body[key].trim().slice(0, max) : "";
}

function optionalAge(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 3 && parsed <= 21 ? parsed : NaN;
}

type ValidContact = { name: string; phone: string; email: string | null };
type InvalidContact = { error: string };

function contact(body: Record<string, unknown>, nameKey: string, phoneKey: string, emailKey: string): ValidContact | InvalidContact {
  const name = text(body, nameKey, 120);
  const phone = text(body, phoneKey, 18).replace(/[\s-]/g, "");
  const email = text(body, emailKey, 160);
  if (name.length < 2) return { error: "Enter the registrant's full name." };
  if (!/^(?:\+91)?[6-9]\d{9}$/.test(phone)) return { error: "Enter a valid Indian mobile number." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  return { name, phone, email: email || null };
}

export function validateMealEnrollment(body: Record<string, unknown>, profile: MealEnrollmentProfile): { data?: MealEnrollmentIntake; error?: string } {
  const consent = body.consent === true || body.consent === "true" || body.consent === "on";
  if (!consent) return { error: "Confirm that LunchBox may use these details to manage the meal registration." };

  const dietaryPreference = text(body, "dietary_preference", 40) || null;
  const allergies = text(body, "allergies", 500) || null;
  const mealPlanInterest = text(body, "meal_plan_interest", 60) || null;
  const preferredMealTime = text(body, "preferred_meal_time", 40) || null;

  if (profile === "school_child") {
    const parent = contact(body, "parent_name", "parent_phone", "parent_email");
    if ("error" in parent) return { error: parent.error };
    const childName = text(body, "child_name", 120);
    const grade = text(body, "grade", 40);
    const age = optionalAge(body.child_age);
    if (childName.length < 2) return { error: "Enter the child's full name." };
    if (!grade) return { error: "Select the child's class or grade." };
    if (Number.isNaN(age)) return { error: "Enter a valid child age." };
    return { data: { personName: childName, contactPhone: parent.phone, contactEmail: parent.email, fields: {
      parent_name: parent.name, parent_phone: parent.phone, parent_email: parent.email,
      relationship: text(body, "relationship", 30) || null,
      child_name: childName, child_age: age, grade, section: text(body, "section", 30) || null,
      dietary_preference: dietaryPreference, allergies, meal_plan_interest: mealPlanInterest,
      preferred_meal_time: preferredMealTime, consent_given: true,
    } } };
  }

  if (profile === "college_student") {
    const student = contact(body, "student_name", "student_phone", "student_email");
    if ("error" in student) return { error: student.error };
    const courseName = text(body, "course_name", 120);
    const studyYear = text(body, "study_year", 40);
    if (courseName.length < 2) return { error: "Enter your course or programme." };
    if (!studyYear) return { error: "Select your year of study." };
    return { data: { personName: student.name, contactPhone: student.phone, contactEmail: student.email, fields: {
      student_name: student.name, student_phone: student.phone, student_email: student.email,
      student_id: text(body, "student_id", 80) || null, course_name: courseName, study_year: studyYear,
      student_type: text(body, "student_type", 30) || null, dietary_preference: dietaryPreference,
      allergies, meal_plan_interest: mealPlanInterest, preferred_meal_time: preferredMealTime, consent_given: true,
    } } };
  }

  const employee = contact(body, "employee_name", "employee_phone", "employee_email");
  if ("error" in employee) return { error: employee.error };
  return { data: { personName: employee.name, contactPhone: employee.phone, contactEmail: employee.email, fields: {
    employee_name: employee.name, employee_phone: employee.phone, employee_email: employee.email,
    employee_id: text(body, "employee_id", 80) || null, designation: text(body, "designation", 120) || null,
    department: text(body, "department", 120) || null, work_schedule: text(body, "work_schedule", 40) || null,
    dietary_preference: dietaryPreference, allergies, meal_plan_interest: mealPlanInterest,
    preferred_meal_time: preferredMealTime, consent_given: true,
  } } };
}
