import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAAWrKX6Vu3DJRmmMrTreR1iwUw_ytUnXg",
  authDomain: "base-total.firebaseapp.com",
  projectId: "base-total",
  storageBucket: "base-total.firebasestorage.app",
  messagingSenderId: "1052334488431",
  appId: "1:1052334488431:web:c8d2071a18bdb6f82e469a",
  measurementId: "G-TWSEGNXFXJ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);