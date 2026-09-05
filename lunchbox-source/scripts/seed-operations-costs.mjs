import { Firestore, FieldValue } from "@google-cloud/firestore";

const projectId = process.env.GCP_PROJECT_ID;
const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";
if (!projectId) throw new Error("GCP_PROJECT_ID is required.");

const staff = [
  { id: "stephen", name: "Stephen", role: "Delivery Lead", baseSalaryInr: 35000, allowanceInr: 5000, monthlyTotalInr: 40000, needsConfirmation: false },
  { id: "malathy", name: "Malathy", role: "Marketing", baseSalaryInr: 90000, allowanceInr: 0, monthlyTotalInr: 90000, needsConfirmation: false },
  { id: "archana", name: "Archana", role: "Operational Manager", baseSalaryInr: 30000, allowanceInr: 0, monthlyTotalInr: 30000, needsConfirmation: false },
  { id: "sister", name: "Sister", role: "Role not recorded", baseSalaryInr: 22000, allowanceInr: 0, monthlyTotalInr: 22000, needsConfirmation: true },
  { id: "anu", name: "Anu", role: "Data Engineer", baseSalaryInr: 23000, allowanceInr: 0, monthlyTotalInr: 23000, needsConfirmation: false },
  { id: "devika", name: "Devika", role: "People Manager", baseSalaryInr: 25000, allowanceInr: 0, monthlyTotalInr: 25000, needsConfirmation: false },
  { id: "sweety-annie", name: "Sweety Annie", role: "Nutrition role (unconfirmed)", baseSalaryInr: 30000, allowanceInr: 0, monthlyTotalInr: 30000, needsConfirmation: true },
];
const lunchMaterials = [
  ["Rice", 2, "kg"], ["Dal", 400, "g"], ["Oil", 300, "ml"], ["Masala", 300, "g"], ["Vegetables", 2, "kg"], ["Gas", 1, "kg"], ["Water", 500, "litres"], ["Vessel-cleaning liquid", 100, "ml"], ["Other dals", 250, "g"],
].map(([item, quantity, unit]) => ({ item, quantity, unit }));
const morningProduction = [
  { id: "idly", name: "Idly", plannedOutputMin: 55, plannedOutputMax: 75, outputUnit: "nos", ingredients: [{ item: "Rice and urad dal", quantity: 1.5, unit: "kg" }], needsConfirmation: true, note: "Handwritten output count was corrected and is unclear." },
  { id: "dosa", name: "Dosa", plannedOutputMin: 40, plannedOutputMax: 40, outputUnit: "nos", ingredients: [{ item: "Batter", quantity: 1.5, unit: "kg" }], needsConfirmation: true, note: "Output appears to be 40; confirm against the source note." },
  { id: "supporting-ingredients", name: "Supporting ingredients", plannedOutputMin: null, plannedOutputMax: null, outputUnit: "batch", ingredients: [{ item: "Oil", quantity: 300, unit: "ml" }, { item: "Gas", quantity: 500, unit: "g" }, { item: "Dal / sambar", quantity: 400, unit: "g" }, { item: "Vegetables", quantity: 1, unit: "kg" }, { item: "Masala", quantity: 300, unit: "g" }], needsConfirmation: false },
  { id: "chapati", name: "Chapati", plannedOutputMin: 35, plannedOutputMax: 44, outputUnit: "nos", ingredients: [{ item: "Wheat flour", quantity: 1.5, unit: "kg" }, { item: "Peas for kurma", quantity: 400, unit: "g" }, { item: "Vegetables for kurma", quantity: 1, unit: "kg" }, { item: "Masala", quantity: 200, unit: "g" }, { item: "Oil", quantity: 300, unit: "ml" }], needsConfirmation: true, note: "Handwritten output count is unclear." },
  { id: "pongal", name: "Pongal", plannedOutputMin: null, plannedOutputMax: null, outputUnit: "batch", ingredients: [{ item: "Rice", quantity: 1.5, unit: "kg" }, { item: "Pasi paruppu / moong dal", quantity: 400, unit: "g" }, { item: "Sambar dal", quantity: 250, unit: "g" }, { item: "Oil", quantity: 200, unit: "ml" }, { item: "Ghee", quantity: 100, unit: "ml" }], needsConfirmation: false },
  { id: "coconut-chutney", name: "Coconut chutney", plannedOutputMin: null, plannedOutputMax: null, outputUnit: "batch", ingredients: [{ item: "Pottukadalai / roasted gram", quantity: 250, unit: "g" }, { item: "Coconut", quantity: 1, unit: "number" }], needsConfirmation: false },
  { id: "vada", name: "Vada", plannedOutputMin: 15, plannedOutputMax: 15, outputUnit: "nos", ingredients: [{ item: "Ulundhu / urad dal", quantity: 500, unit: "g" }, { item: "Oil", quantity: 250, unit: "ml", needsConfirmation: true }], needsConfirmation: true, note: "Oil quantity/unit should be confirmed." },
];

const firestore = new Firestore({ projectId, databaseId });
await firestore.collection("operations_plans").doc("default").set({
  version: 1,
  source: "Handwritten operating plan transcription supplied 2026-08-07",
  staff,
  lunchMaterials,
  morningProduction,
  updated_at: FieldValue.serverTimestamp(),
}, { merge: true });
process.stdout.write(`Seeded operations_plans/default in ${projectId}.\n`);
