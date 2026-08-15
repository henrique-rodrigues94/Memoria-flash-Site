import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// A configuração do Firebase Web não é um segredo: ela identifica o projeto.
// Mantemos suporte às variáveis VITE_* para ambientes personalizados, mas
// usamos a configuração oficial do projeto em produção para que o site
// também funcione quando o Hosting não injeta variáveis de ambiente.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAaRwF97HfsJFy37Y8T5Wethsv5eye7df0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "flashcardsia-a2f43.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "flashcardsia-a2f43",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "flashcardsia-a2f43.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "773874565537",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:773874565537:web:1cd3a96a3fc6939c4fcbe0",
};

const hasConfig = Object.values(firebaseConfig).every(Boolean);

export const firebaseConfigured = hasConfig;

const app = hasConfig ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

// Mantém a sessão entre recargas e abas.
// O app aguarda esta Promise antes de iniciar o fluxo de login.
export const authPersistenceReady = auth
  ? setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn(
        "[Firebase Auth] Não foi possível ativar persistência local:",
        error,
      );
      return null;
    })
  : Promise.resolve(null);
