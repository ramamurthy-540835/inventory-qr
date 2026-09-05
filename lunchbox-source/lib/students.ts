import { firestoreClient } from "@/lib/firestore";

export type FranchiseStudent = {
  id: string;
  franchiseId: string;
  name: string;
  school: string;
  standard: number;
  section: string;
  parentContact: string;
  dietaryPreference: string;
  allergies: string;
  subscriptionStatus: string;
};

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export async function getStudentsByFranchise(franchiseId: string) {
  const snapshot = await firestoreClient().collection("franchise_students").where("franchiseId", "==", franchiseId).orderBy("name").limit(1000).get();
  return snapshot.docs.map((document): FranchiseStudent => {
    const item = document.data();
    return { id: document.id, franchiseId: text(item.franchiseId), name: text(item.name), school: text(item.school), standard: Number(item.standard) || 0, section: text(item.section), parentContact: text(item.parentContact), dietaryPreference: text(item.dietaryPreference), allergies: text(item.allergies), subscriptionStatus: text(item.subscriptionStatus) };
  });
}
