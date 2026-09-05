import { after } from "next/server";
import { BigQuerySchoolAnalytics } from "@/lib/school-locator/bigquery-analytics";
import { FirestoreSchoolDirectory } from "@/lib/school-locator/firestore-directory";
import { PrivateSchoolLocatorAgent } from "@/lib/school-locator/private-school-locator-agent";
import { GooglePlacesProvider } from "@/lib/school-locator/providers/google-places-provider";
import { SerpApiGoogleMapsProvider } from "@/lib/school-locator/providers/serpapi-provider";

export const schoolDirectory = new FirestoreSchoolDirectory();
export const schoolAnalytics = new BigQuerySchoolAnalytics();

export const privateSchoolLocatorAgent = new PrivateSchoolLocatorAgent({
  repository: schoolDirectory,
  google: new GooglePlacesProvider(),
  serpapi: new SerpApiGoogleMapsProvider(),
  analytics: schoolAnalytics,
  defer: (task) => after(task),
});
