type AuthSession = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
} | null;

export const authClient = {
  signIn: async () => ({ success: true }),
  signOut: async () => ({ success: true }),
  signUp: async () => ({ success: true }),
};

export const signIn = authClient.signIn;
export const signOut = authClient.signOut;
export const signUp = authClient.signUp;

export function useSession(): { data: AuthSession; isPending: boolean } {
  return { data: null, isPending: false };
}
