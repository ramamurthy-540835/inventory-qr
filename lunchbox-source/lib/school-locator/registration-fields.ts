import type { SchoolSearchResult } from "@/lib/school-locator/types";

export function toSchoolRegistrationFields(school: SchoolSearchResult) {
  return {
    selected_school_id: school.id,
    school_name: school.school_name,
    school_address: school.formatted_address,
    school_locality: school.locality,
    school_zone: school.zone_name,
    school_city: school.city_name,
    school_state: school.state,
    school_pincode: school.postal_code || "",
    school_latitude: school.latitude,
    school_longitude: school.longitude,
    provider_place_id: school.provider_place_id || "",
  };
}
