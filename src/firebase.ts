import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDcxK25ZJwzcPiDexSrh8RcWhb2bHRcfQc",
  authDomain: "refereepay-5afd9.firebaseapp.com",
  projectId: "refereepay-5afd9",
  storageBucket: "refereepay-5afd9.firebasestorage.app",
  messagingSenderId: "860495632892",
  appId: "1:860495632892:web:c06db3f0a28d129ee33a79",
  measurementId: "G-CNXFDFTDMH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize and export Database (Firestore)
export const db = getFirestore(app);
