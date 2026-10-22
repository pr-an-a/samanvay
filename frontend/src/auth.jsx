import { createContext, useContext, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, session } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(session.user());

  async function login(userId) {
    const { token, user } = await api("/auth/login", { method: "POST", body: { user_id: userId } });
    session.save(token, user);
    setUser(user);
  }

  function logout() {
    session.clear();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
