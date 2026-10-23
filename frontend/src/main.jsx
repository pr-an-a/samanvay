import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/400-italic.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AdminOnly, AuthProvider, RequireAuth } from "./auth";
import Layout from "./components/Layout";
import "./index.css";
import AccuracyPage from "./pages/AccuracyPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import InboxPage from "./pages/InboxPage";
import AlertsPage from "./pages/AlertsPage";
import AuditPage from "./pages/AuditPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import CasesPage from "./pages/CasesPage";
import DashboardPage from "./pages/DashboardPage";
import EscalationsPage from "./pages/EscalationsPage";
import InstitutionPage from "./pages/InstitutionPage";
import LoginPage from "./pages/LoginPage";
import NewComplaintPage from "./pages/NewComplaintPage";
import ReviewPage from "./pages/ReviewPage";
import StoryPage from "./pages/StoryPage";
import StressPage from "./pages/StressPage";
import WithoutWithPage from "./pages/WithoutWithPage";
import { TourProvider } from "./tour";
import { VideoProvider } from "./video";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TourProvider>
          <VideoProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/story" element={<StoryPage />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<InboxPage />} />
              <Route path="reports" element={<DashboardPage />} />
              <Route path="how-it-works" element={<HowItWorksPage />} />
              <Route path="cases" element={<CasesPage />} />
              <Route path="cases/:id" element={<CaseDetailPage />} />
              <Route path="institutions/:id" element={<InstitutionPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="links/:id" element={<ReviewPage />} />
              <Route path="new" element={<NewComplaintPage />} />
              <Route path="without-with" element={<WithoutWithPage />} />
              <Route path="stress" element={<StressPage />} />
              <Route path="accuracy" element={<AccuracyPage />} />
              <Route path="escalations" element={<AdminOnly><EscalationsPage /></AdminOnly>} />
              <Route path="audit" element={<AdminOnly><AuditPage /></AdminOnly>} />
              <Route path="*" element={<p className="text-xl">This page does not exist.</p>} />
            </Route>
          </Routes>
          </VideoProvider>
        </TourProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
