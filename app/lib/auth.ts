import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "./firebase";

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  const result = await signInWithPopup(auth, provider);

  const user = result.user;

  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      fullName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || null,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  return user;
}
