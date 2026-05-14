import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useWallet } from "./context/WalletContext";
import { PoolProvider } from "./context/PoolContext";
import HomePage from "./pages/HomePage";
import WalletPage from "./pages/WalletPage";
import UsernameModal from "./components/UsernameModal";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  const { address, needsUsername, walletChanged } = useWallet();

  return (
    <PoolProvider>
      {needsUsername && <UsernameModal />}
      <Routes>
        <Route
          path="/"
          element={address ? <Navigate to="/wallet" replace /> : <HomePage />}
        />
        <Route
          path="/wallet"
          element={
            address || walletChanged
              ? <WalletPage />
              : <Navigate to="/" replace />
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </PoolProvider>
  );
}