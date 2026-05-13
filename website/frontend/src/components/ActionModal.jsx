import React from "react";
import DepositModal from "./DepositModal";
import TransferModal from "./TransferModal";
import WithdrawModal from "./WithdrawModal";

export default function ActionModal({ type, onClose }) {
  if (type === "deposit")  return <DepositModal  onClose={onClose} />;
  if (type === "transfer") return <TransferModal onClose={onClose} />;
  if (type === "withdraw") return <WithdrawModal onClose={onClose} />;
  return null;
}