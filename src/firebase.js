import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBJkp3_boAeDIoZ1XWKhJ1MohdL4JenwWU",
  authDomain: "mpg-fantasy.firebaseapp.com",
  projectId: "mpg-fantasy",
  storageBucket: "mpg-fantasy.firebasestorage.app",
  messagingSenderId: "416520898480",
  appId: "1:416520898480:web:ec6786166f4d10f0917875"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);
