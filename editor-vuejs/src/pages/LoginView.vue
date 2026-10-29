<template>
  <div class="login-page">
    <h1>Login</h1>

    <form @submit.prevent="loginLocal">
      <input v-model="username" placeholder="Username" />
      <input v-model="password" type="password" placeholder="Password" />
      <button type="submit">Login</button>
    </form>

    <hr />
    <GoogleLogin :callback="onGoogleSuccess" />

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup>
import { checkSession, refreshAccessToken } from "@/lib/common/useAuth";
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { GoogleLogin } from "vue3-google-login";

const username = ref("");
const password = ref("");
const error = ref("");
const router = useRouter();

const API = "http://localhost:8008";

// === Helper functions ===
function saveSession({ accessToken, refreshToken, user }) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
  if (user?.username) localStorage.setItem("username", user.username);
  if (user?.name) localStorage.setItem("displayName", user.name);
  if (user?.picture) localStorage.setItem("avatar", user.picture);
}

// async function refreshAccessToken() {
//   const refreshToken = localStorage.getItem("refreshToken");
//   if (!refreshToken) return false;
//   const res = await fetch(`${API}/auth/refresh`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ refreshToken }),
//   });
//   if (!res.ok) return false;
//   const data = await res.json();
//   localStorage.setItem("accessToken", data.accessToken);
//   return true;
// }

// async function checkSession() {
//   const accessToken = localStorage.getItem("accessToken");
//   if (!accessToken) return false;
//   const res = await fetch(`${API}/me`, {
//     headers: { Authorization: `Bearer ${accessToken}` },
//   });
//   if (res.ok) {
//     router.push("/");
//     return true;
//   }
//   const refreshed = await refreshAccessToken();
//   if (refreshed) {
//     router.push("/");
//     return true;
//   }
//   return false;
// }

// === Local login ===
async function loginLocal() {
  error.value = "";
  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: username.value,
      password: password.value,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    error.value = data.error || "Login failed";
    return;
  }
  saveSession(data);
  router.push("/");
}

// === Google login ===
async function onGoogleSuccess(response) {
  error.value = "";
  const res = await fetch(`${API}/auth/google/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: response.credential }),
  });
  const data = await res.json();
  if (!res.ok) {
    error.value = data.error || "Google login failed";
    return;
  }
  saveSession(data);
  router.push("/");
}

onMounted(() => {
  checkSession(router);
  setInterval(refreshAccessToken, 10 * 60 * 1000);
});
</script>

<style scoped>
.login-page {
  max-width: 400px;
  margin: 60px auto;
  text-align: center;
}
input {
  display: block;
  margin: 10px auto;
  padding: 8px;
  width: 80%;
}
button {
  padding: 8px 16px;
}
.error {
  color: red;
}
</style>
