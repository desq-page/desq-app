<template>
  <div>
    <p>Login successful!</p>
    <p>Token: {{ token }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const token = ref("");

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  token.value = urlParams.get("token");

  if (token.value) {
    localStorage.setItem("auth_token", token.value);
  }
});
</script>