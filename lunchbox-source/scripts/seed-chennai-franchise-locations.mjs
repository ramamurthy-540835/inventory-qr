import { Firestore, FieldValue } from "@google-cloud/firestore";

if (process.env.CONFIRM_FRANCHISE_TERRITORY_SEED !== "yes") {
  throw new Error("Set CONFIRM_FRANCHISE_TERRITORY_SEED=yes before publishing territory opportunities.");
}

const db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT || "chennaifood" });
const locations = [
  ["kasimedu", "Kasimedu", "north", "North Chennai", 13.1261, 80.2930],
  ["washermenpet", "Washermenpet", "north", "North Chennai", 13.1149, 80.2879],
  ["manali", "Manali", "north", "North Chennai", 13.1667, 80.2556],
  ["anna-nagar", "Anna Nagar", "central", "Central Chennai", 13.0850, 80.2101],
  ["t-nagar", "T. Nagar", "central", "Central Chennai", 13.0418, 80.2341],
  ["nandanam", "Nandanam", "central", "Central Chennai", 13.0320, 80.2395],
  ["porur", "Porur", "west", "West Chennai", 13.0358, 80.1582],
  ["madhuravoyal", "Maduravoyal", "west", "West Chennai", 13.0628, 80.1660],
  ["ambattur", "Ambattur", "west", "West Chennai", 13.1143, 80.1548],
  ["adyar", "Adyar", "south", "South Chennai", 13.0067, 80.2575],
  ["velachery", "Velachery", "south", "South Chennai", 12.9791, 80.2212],
  ["tambaram", "Tambaram", "south", "South Chennai", 12.9249, 80.1000],
  ["thoraipakkam", "Thoraipakkam", "omr", "OMR & ECR", 12.9426, 80.2366],
  ["sholinganallur", "Sholinganallur", "omr", "OMR & ECR", 12.9010, 80.2279],
  ["perungudi", "Perungudi", "omr", "OMR & ECR", 12.9612, 80.2416],
];

const batch = db.batch();
for (const [index, [id, name, zoneId, zoneName, lat, lng]] of locations.entries()) {
  const reference = db.collection("franchise_locations").doc(id);
  batch.set(reference, {
    name, zoneId, zoneName, lat, lng,
    plannedFranchiseCount: index < 3 ? 14 : 13,
    dailyStudentCapacity: 1500,
    status: "available",
    franchiseCount: 0,
    activeDriverCount: 0,
    city: "Chennai",
    dataSource: "Chennai locality centroid",
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}
await batch.commit();
console.log(`Published ${locations.length} Chennai franchise opportunity locations.`);
