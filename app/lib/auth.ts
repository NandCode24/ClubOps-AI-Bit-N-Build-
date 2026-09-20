import { authClient } from "./auth-client";

export { authClient };

export async function signInWithGoogle() {
  return authClient.signIn.social({
    provider: "google",
    callbackURL: "/dashboard",
  });
}
