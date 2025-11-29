import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  getDocs,
  writeBatch
} from "firebase/firestore";
import { Study } from "../types";

// --- IMPORTANT FIREBASE SETUP ---
// The application is getting stuck because of a Firebase permissions issue.
// To fix this, you must create and configure your own Firebase project.
// 1. Go to https://console.firebase.google.com/ and create a new project.
// 2. In your project, go to "Build" > "Firestore Database" and create a database.
// 3. In the Firestore "Rules" tab, update your rules to allow public access for this demo.
//    **This is insecure for production apps, but necessary for this public demo.**
//    Replace existing rules with:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /{document=**} {
//          allow read, write: if true;
//        }
//      }
//    }
// 4. In your project settings (click the gear icon), find your Web App configuration
//    and copy the values into the `firebaseConfig` object below.
// 5. For deployment (e.g., on Netlify), it is highly recommended to use environment variables
//    (e.g., import.meta.env.VITE_FIREBASE_API_KEY) instead of hardcoding these values.

// V V V V V  请将下方整个对象替换为您自己 Firebase 项目的配置  V V V V V
const firebaseConfig = {
  // 举例, 请务必替换:
  apiKey: "AIzaSyBPRoW7zoNrQd8h6HhZJOT3HnaZYPEX00I",
  authDomain: "weight-loss-30df5.firebaseapp.com",
  projectId: "weight-loss-30df5",
  storageBucket: "weight-loss-30df5.firebasestorage.app",
  messagingSenderId: "987737282758",
  appId: "1:987737282758:web:ab3b49351278e084695fc7",
  measurementId: "G-12DB4VZZ0Q"
};
// ^ ^ ^ ^ ^  请将上方整个对象替换为您自己 Firebase 项目的配置  ^ ^ ^ ^ ^


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const COLLECTION_NAME = "weight_loss_studies";

export const addStudy = async (studyData: Omit<Study, 'id' | 'createdAt'>) => {
  try {
    await addDoc(collection(db, COLLECTION_NAME), {
      ...studyData,
      createdAt: Date.now()
    });
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
};

export const deleteStudy = async (id: string) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (e) {
    console.error("Error deleting document: ", e);
    throw e;
  }
};

export const deleteSelectedStudies = async (ids: string[]) => {
  if (ids.length === 0) return;

  try {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      const docRef = doc(db, COLLECTION_NAME, id);
      batch.delete(docRef);
    });
    await batch.commit();
  } catch (e) {
    console.error("Error deleting selected documents: ", e);
    throw e;
  }
};

export const deleteAllStudies = async () => {
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return;
    }

    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

  } catch (e) {
    console.error("Error deleting all documents: ", e);
    throw e;
  }
};

export const subscribeToStudies = (callback: (studies: Study[]) => void) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const studies: Study[] = [];
    snapshot.forEach((doc) => {
      studies.push({ id: doc.id, ...doc.data() } as Study);
    });
    callback(studies);
  });
};