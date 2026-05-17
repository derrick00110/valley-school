// ===================== Firebase 初始化 =====================
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC2d7pmrUvayDP-sp7ecc05JmcT4okJ7QA",
  authDomain: "sgyy-school.firebaseapp.com",
  databaseURL: "https://sgyy-school-default-rtdb.firebaseio.com",
  projectId: "sgyy-school",
  storageBucket: "sgyy-school.firebasestorage.app",
  messagingSenderId: "1009728474580",
  appId: "1:1009728474580:web:b48c0e1a0f5b60ec495a41",
  measurementId: "G-KRRL1Z2LTS"
};

// 安全初始化：防止配置错误导致整个应用崩溃
let app: any = null;
let auth: any = null;
let db: any = null;
export let firebaseReady = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  firebaseReady = true;
  console.log('✅ Firebase 初始化成功');
} catch (e) {
  console.warn('⚠️ Firebase 初始化失败，应用将以离线模式运行', e);
  firebaseReady = false;
}

export { auth, db };
export const APP_ID = 'valley-school';
