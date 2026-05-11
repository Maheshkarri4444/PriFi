const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export async function getAllUsers() {
  const res = await fetch(`${BASE_URL}/users/all`);
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function createUser(data) {
  console.log("called create user");
  console.log("baseurl:",BASE_URL);
  const res = await fetch(`${BASE_URL}/users/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  console.log("res",res);
  if (!res.ok) {

    const err = await res.json();
    console.log("failed ere:",err);
    throw new Error(err.error || "Failed to create user");
  }
  return res.json();
}

export async function getRelayerWallet() {
  const res = await fetch(`${BASE_URL}/relayer/get`);
  if (!res.ok) throw new Error("Failed to fetch relayer");
  return res.json();
}

export async function getLatestState() {
  const res = await fetch(`${BASE_URL}/state/latest`);
  if (!res.ok) throw new Error("Failed to fetch state");
  return res.json();
}