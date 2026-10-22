import { createContext, useContext, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, session } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(session.user());
  // True after "Switch user": the next person should start on the overview, not on the last page.
  const [switched, setSwitched] = useState(false);

  async function login(userId) {
    const { token, user } = await api("/auth/login", { method: "POST", body: { user_id: userId } });
    session.save(token, user);
    setSwitched(false);
    setUser(user);
  }

  function logout() {
    session.clear();
    setSwitched(true);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, switched, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children }) {
  const { user, switched } = useAuth();
  const location = useLocation();
  // Remember the page only when someone arrives signed out (e.g. a bookmark), not after "Switch user".
  if (!user) return <Navigate to="/login" replace state={switched ? undefined : { from: location.pathname + location.search }} />;
  return children;
}

export function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") {
    return <p className="text-xl text-ink-2">Only administrators can see this page. Use “Switch user” to sign in as the Administrator.</p>;
  }
  return children;
}
