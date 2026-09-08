import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

async function clearCollections() {
  const collectionsToClear = ["orderRequests", "menuItems", "categories", "scans"];
  
  for (const colName of collectionsToClear) {
    console.log(`Clearing collection: ${colName}...`);
    const snap = await getDocs(collection(db, colName));
    let deletedCount = 0;
    for (const d of snap.docs) {
      await deleteDoc(doc(db, colName, d.id));
      deletedCount++;
    }
    console.log(`Deleted ${deletedCount} documents from '${colName}'.`);
  }
  
  console.log("All specified Firestore collections cleared successfully!");
  process.exit(0);
}

clearCollections().catch((err) => {
  console.error("Failed to clear collections:", err);
  process.exit(1);
});
