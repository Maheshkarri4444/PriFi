import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useWallet } from "./context/WalletContext";
import HomePage from "./pages/HomePage";
import WalletPage from "./pages/WalletPage";
import UsernameModal from "./components/UsernameModal";

export default function App() {
  const { address, needsUsername, walletChanged } = useWallet();

  return (
    <>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}