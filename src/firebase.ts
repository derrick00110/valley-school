// ===================== Firebase 初始化 =====================
// ⚠️ 重要：使用前必读！
//
// 步骤一、创建 Firebase 项目
// 1. 打开 https://console.firebase.google.com/ 点「添加项目」
// 2. 项目名称：山谷音乐学校（或您喜欢的名字）
// 3. 不启用 Google Analytics，点「创建项目」
//
// 步骤二、注册 Web 应用
// 1. 在项目概览页，点 Web 图标（&lt;/&gt;）注册应用
// 2. 应用昵称：valley-school
// 3. 复制显示的 firebaseConfig 对象
// 4. 粘贴到下面 ⬇️
//
// 步骤三、启用服务
// 1. 左侧菜单 Authentication → 登录方式 → 匿名登录 → 启用
// 2. 左侧菜单 Firestore Database → 创建数据库 → 测试模式 → 选择离你近的区域
//
// 步骤四、添加初始数据（在 Firestore 中）
// 集合路径：teachers
// 文档 ID：auto（或任意）
// 字段：name: "郭老师", storeId: "dongguan", role: "teacher"

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const APP_ID = 'valley-school';

// 数据库集合名称（每个门店独立一套）
// 例如 students_dongguan, students_chebei
export const COLLECTIONS = {
  TEACHERS: 'teachers',        // 老师（不分门店）
  STUDENTS: 'students',        // + _门店ID
  ENROLLMENTS: 'enrollments',  // + _门店ID
  LESSONS: 'lessons',          // + _门店ID
  SCHEDULES: 'schedules',      // + _门店ID
};
