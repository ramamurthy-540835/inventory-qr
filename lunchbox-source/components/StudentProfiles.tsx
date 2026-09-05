"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { firebaseAuth } from "@/lib/firebase-client";

export type StudentSelection = { id: string; studentName: string };

type GoogleAddressComponent = { long_name?: string; types?: string[] };
type GooglePlace = { address_components?: GoogleAddressComponent[] };
type GoogleAutocomplete = { addListener: (event: string, callback: () => void) => { remove?: () => void }; getPlace: () => GooglePlace };
type GoogleMapsWindow = Window & { google?: { maps?: { places?: { Autocomplete?: new (input: HTMLInputElement, options: Record<string, unknown>) => GoogleAutocomplete } } } };

type StudentDocument = {
  id: string;
  student_name: string;
  school_id: string;
  grade_band: string;
  section?: string;
  roll_number?: string;
  relationship?: string;
  allergies: string[];
};

export default function StudentProfiles({ schoolId, gradeBand, onChange }: { schoolId: string; gradeBand: string; onChange: (student: StudentSelection | null) => void }) {
  const [students, setStudents] = useState<StudentDocument[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const addressLine1Ref = useRef<HTMLInputElement>(null);
  const addressLine2Ref = useRef<HTMLInputElement>(null);
  const addressCityRef = useRef<HTMLInputElement>(null);
  const addressStateRef = useRef<HTMLInputElement>(null);
  const addressPincodeRef = useRef<HTMLInputElement>(null);

  const loadStudents = useCallback(async () => {
    const token = await firebaseAuth()?.currentUser?.getIdToken();
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch("/api/students", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load student profiles.");
      setStudents(data.students);
      const match = data.students.find((student: StudentDocument) => student.school_id === schoolId && student.grade_band === gradeBand);
      setSelectedId(match?.id || "");
      onChange(match ? { id: match.id, studentName: match.student_name } : null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load student profiles.");
    } finally {
      setLoading(false);
    }
  }, [gradeBand, onChange, schoolId]);

  useEffect(() => { void loadStudents(); }, [loadStudents]);

  useEffect(() => {
    let cancelled = false;
    let listener: { remove?: () => void } | undefined;
    async function setupAddressAutocomplete() {
      const response = await fetch("/api/maps/config");
      const config = await response.json() as { key?: string };
      if (!config.key || cancelled) return;
      const start = () => {
        const maps = (window as GoogleMapsWindow).google?.maps;
        const Autocomplete = maps?.places?.Autocomplete;
        if (!Autocomplete || !addressLine1Ref.current) return;
        const autocomplete = new Autocomplete(addressLine1Ref.current, { componentRestrictions: { country: "in" }, fields: ["address_components", "formatted_address"], types: ["address"] });
        listener = autocomplete.addListener("place_changed", () => {
          const components = autocomplete.getPlace().address_components || [];
          const value = (type: string) => components.find((item: GoogleAddressComponent) => item.types?.includes(type))?.long_name || "";
          if (addressLine2Ref.current) addressLine2Ref.current.value = value("sublocality_level_1") || value("sublocality");
          if (addressCityRef.current) addressCityRef.current.value = value("locality");
          if (addressStateRef.current) addressStateRef.current.value = value("administrative_area_level_1") || "Tamil Nadu";
          if (addressPincodeRef.current) addressPincodeRef.current.value = value("postal_code");
        });
      };
      if ((window as GoogleMapsWindow).google?.maps?.places?.Autocomplete) { start(); return; }
      const script = document.createElement("script");
      script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(config.key) + "&libraries=places";
      script.async = true; script.onload = start; document.head.appendChild(script);
    }
    void setupAddressAutocomplete().catch(() => undefined);
    return () => { cancelled = true; listener?.remove?.(); };
  }, [loading]);

  async function createStudent(form: FormData) {
    const token = await firebaseAuth()?.currentUser?.getIdToken();
    if (!token) return setMessage("Verify the parent mobile number before adding a student.");

    const allergies = String(form.get("allergies") || "").split(",");
    const response = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        studentName: form.get("profileStudentName"),
        schoolId,
        gradeBand,
        section: form.get("profileSection"),
        rollNumber: form.get("profileRollNumber"),
        relationship: form.get("profileRelationship"),
        homeAddress: {
          line1: form.get("homeAddressLine1"),
          line2: form.get("homeAddressLine2"),
          city: form.get("homeAddressCity"),
          state: form.get("homeAddressState"),
          pincode: form.get("homeAddressPincode"),
          landmark: form.get("homeAddressLandmark"),
        },
        allergies,
        allergyAcknowledged: form.get("allergyAcknowledged") === "on",
      }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to save student profile.");

    const student = {
      id: data.id,
      student_name: data.studentName,
      school_id: schoolId,
      grade_band: gradeBand,
      section: data.section,
      roll_number: data.rollNumber,
      relationship: data.relationship,
      allergies: data.allergies,
    };
    setStudents((current) => [...current, student]);
    setSelectedId(data.id);
    onChange({ id: data.id, studentName: data.studentName });
    setMessage("Student profile saved.");
  }

  const eligible = students.filter((student) => student.school_id === schoolId && student.grade_band === gradeBand);
  if (loading) return <small>Loading student profiles...</small>;

  return <div className="student-profile-panel">
    {eligible.length > 0 && <label>Student profile<select value={selectedId} onChange={(event) => {
      const student = eligible.find((item) => item.id === event.target.value);
      setSelectedId(event.target.value);
      onChange(student ? { id: student.id, studentName: student.student_name } : null);
    }}><option value="" disabled>Select student</option>{eligible.map((student) => <option value={student.id} key={student.id}>{student.student_name}{student.section ? ` - ${student.section}` : ""}</option>)}</select></label>}
    <div className="student-form-heading">
      <b>{eligible.length ? "Add another student" : "Register student"}</b>
      <small>Home address is kept for parent records. Lunch delivery remains school-based.</small>
    </div>
    <label>Student full name<input name="profileStudentName" required minLength={2} maxLength={100} placeholder="e.g. Nila Raman" /></label>
    <div className="form-grid">
      <label>Section, optional<input name="profileSection" maxLength={20} placeholder="e.g. B" /></label>
      <label>Roll/admission no., optional<input name="profileRollNumber" maxLength={40} placeholder="e.g. A1024" /></label>
    </div>
    <label>Parent relationship<select name="profileRelationship" required defaultValue="mother"><option value="mother">Mother</option><option value="father">Father</option><option value="guardian">Guardian</option></select></label>
    <fieldset>
      <legend>Home address</legend>
      <label>House/flat and street<input ref={addressLine1Ref} name="homeAddressLine1" required maxLength={160} placeholder="Type 3+ letters to search your address" autoComplete="street-address" /></label>
      <label>Area/locality, optional<input ref={addressLine2Ref} name="homeAddressLine2" maxLength={160} placeholder="Adyar" /></label>
      <div className="form-grid">
        <label>City<input ref={addressCityRef} name="homeAddressCity" required maxLength={80} placeholder="Chennai" /></label>
        <label>State<input ref={addressStateRef} name="homeAddressState" required maxLength={80} defaultValue="Tamil Nadu" /></label>
      </div>
      <div className="form-grid">
        <label>Pincode<input ref={addressPincodeRef} name="homeAddressPincode" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="600020" /></label>
        <label>Landmark, optional<input name="homeAddressLandmark" maxLength={120} placeholder="Near bus stop" /></label>
      </div>
    </fieldset>
    <label>Known allergies<input name="allergies" placeholder="e.g. peanut, milk, or leave blank" /></label>
    <label className="checkbox-label"><input name="allergyAcknowledged" type="checkbox" required /> <span>I confirm the allergy information is complete and will notify the school and kitchen of changes.</span></label>
    <button type="button" onClick={(event) => void createStudent(new FormData(event.currentTarget.form!))}>Save student profile</button>
    {message && <small role="status">{message}</small>}
  </div>;
}
