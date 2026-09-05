import { after } from "next/server";
import { BigQueryEntityAnalytics } from "@/lib/entity-locator/bigquery-analytics";
import { LocationEntitySearchService } from "@/lib/entity-locator/entity-search-service";
import { FirestoreEntityDirectory } from "@/lib/entity-locator/firestore-directory";
import { GoogleLocationEntityProvider } from "@/lib/entity-locator/providers/google-places-provider";
import { SerpApiLocationEntityProvider } from "@/lib/entity-locator/providers/serpapi-provider";

export const entityDirectory = new FirestoreEntityDirectory();
export const entityAnalytics = new BigQueryEntityAnalytics();
export const locationEntitySearchService = new LocationEntitySearchService({
  repository: entityDirectory, google: new GoogleLocationEntityProvider(), serpapi: new SerpApiLocationEntityProvider(),
  analytics: entityAnalytics, defer: (task) => after(task),
});
