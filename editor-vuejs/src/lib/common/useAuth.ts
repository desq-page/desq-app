// src/composables/useAuth.js
import { ref } from "vue";

export const user = ref(null);
export const isLoading = ref(true);

const SERVER = "http://localhost:8008";

export async function checkSession(router) {
  const user = await fetchUser();
  if (user) {
    router.push("/");
  } else {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      router.push("/");
    }
  }
}

export async function fetchUser() {
  const accessToken = localStorage.getItem("accessToken");
  if (!accessToken) return null;
  try {
    const res = await fetch(`${SERVER}/me?`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: "include",
    });
    if (res.ok) {
      try {
        const data = await res.json();
        return data.user;
      } catch (err) {
        return null;
      }
    }
  } catch (err) {
    return null;
  }
  return null;
}

export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;
  let res;
  try {
    res = await fetch(`${SERVER}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (err) {
    return false;
  }
  if (!res?.ok) return false;
  try {
    const data = await res.json();
    localStorage.setItem("accessToken", data.accessToken);
    return true;
  } catch (err) {
    return false;
  }
}

// export async function fetchUser() {
//   try {
//     const res = await fetch(`${SERVER}/me`, { credentials: "include" });
//     if (res.ok) {
//       const data = await res.json();
//       user.value = data.user;
//     } else {
//       user.value = null;
//     }
//   } catch {
//     user.value = null;
//   } finally {
//     isLoading.value = false;
//   }
// }

export async function logout() {
  await fetch(`${SERVER}/logout`, { credentials: "include" });
  // user.value = null;
}
