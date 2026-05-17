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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const APP_ID = 'valley-school';
