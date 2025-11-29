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
  writeBatch,
  updateDoc
} from "firebase/firestore";
import { Study } from "../types";

// --- Firebase 项目配置 (Netlify 部署) ---
// 为了安全地部署到 Netlify，您的 Firebase 密钥已切换为使用环境变量。
// 请在 Netlify 的项目设置中配置以下环境变量:
//
// 1. 进入 Netlify 项目 > Site configuration > Build & deploy > Environment > Environment variables.
// 2. 点击 "New variable" 并添加以下所有密钥:
//    - FIREBASE_API_KEY: "your-api-key"
//    - FIREBASE_AUTH_DOMAIN: "your-auth-domain"
//    - FIREBASE_PROJECT_ID: "your-project-id"
//    - FIREBASE_STORAGE_BUCKET: "your-storage-bucket"
//    - FIREBASE_MESSAGING_SENDER_ID: "your-sender-id"
//    - FIREBASE_APP_ID: "your-app-id"
//    - FIREBASE_MEASUREMENT_ID: "your-measurement-id" (可选)
//
// 确保使用您自己 Firebase 项目的真实值。

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// 检查是否所有必需的环境变量都已设置
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  const errorMsg = "Firebase 配置缺失。请确保已在 Netlify 的环境变量设置中配置所有必需的 FIREBASE_* 密钥。";
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `<div style="padding: 2rem; text-align: center; background-color: #FFFBEB; border: 1px solid #FEE2B3; border-radius: 0.5rem; margin: 2rem; color: #92400E;">
      <h2 style="font-size: 1.25rem; font-weight: bold;">配置错误</h2>
      <p style="margin-top: 0.5rem;">${errorMsg}</p>
      <p style="margin-top: 1rem; font-size: 0.875rem; color: #B45309;">请参考 <code>services/firebaseService.ts</code> 文件中的说明进行配置。</p>
    </div>`;
  }
  throw new Error(errorMsg);
}


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

export const updateStudy = async (id: string, studyData: Partial<Omit<Study, 'id'>>) => {
  try {
    const studyRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(studyRef, studyData);
  } catch (e) {
    console.error("Error updating document: ", e);
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
      const data = doc.data();
      // Standardize drug names to be capitalized
      if (data.drugName && typeof data.drugName === 'string') {
          data.drugName = data.drugName.charAt(0).toUpperCase() + data.drugName.slice(1).toLowerCase();
      }
      studies.push({ id: doc.id, ...data } as Study);
    });
    callback(studies);
  });
};