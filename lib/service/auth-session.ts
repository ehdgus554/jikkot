import type { User } from "firebase/auth";

type SessionUser = Pick<User, "isAnonymous" | "email" | "getIdTokenResult">;

// providerData lists linked providers, not the provider of this session.
// Match the same sign_in_provider claim that the server verifies.
export async function activationPath(user: SessionUser) {
  if (user.isAnonymous) throw new Error("인증을 먼저 완료해주세요.");
  const { signInProvider } = await user.getIdTokenResult();
  if (signInProvider === "google.com") return "/social/activate";
  if (signInProvider === "password") return "/signup";
  throw new Error("이메일 또는 구글로 다시 로그인해주세요.");
}

export async function canResumeEmailSignup(
  user: SessionUser | null,
  email: string,
) {
  if (!user || user.isAnonymous || user.email !== email) return false;
  const { signInProvider } = await user.getIdTokenResult();
  return signInProvider === "password";
}
