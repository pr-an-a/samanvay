import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, RequireAuth } from "./auth";
import Layout from "./components/Layout";
import "./index.css";
import AccuracyPage from "./pages/AccuracyPage";
import AlertsPage from "./pages/AlertsPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import CasesPage from "./pages/CasesPage";
import DashboardPage from "./pages/DashboardPage";
import InstitutionPage from "./pages/InstitutionPage";
import LoginPage from "./pages/LoginPage";
import NewComplaintPage from "./pages/NewComplaintPage";
import ReviewPage from "./pages/ReviewPage";
import { TourProvider } from "./tour";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TourProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="cases" element={<CasesPage />} />
              <Route path="cases/:id" element={<CaseDetailPage />} />
              <Route path="institutions/:id" element={<InstitutionPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="links/:id" element={<ReviewPage />} />
              <Route path="new" element={<NewComplaintPage />} />
              <Route path="accuracy" element={<AccuracyPage />} />
              <Route path="*" element={<p className="text-xl">This page does not exist.</p>} />
            </Route>
          </Routes>
        </TourProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
