import { Buffer } from "buffer";

window.Buffer = Buffer;
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { WalletProvider } from "./context/WalletContext";
import { PoolProvider } from "./context/PoolContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <PoolProvider>
          <App />
        </PoolProvider>
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);