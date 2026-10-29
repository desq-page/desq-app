<template>
  <div>
    <button @click="loginWithGoogle">Login with Google</button>
  </div>
</template>

<script setup>
function loginWithGoogle() {
  window.location.href = "/auth/google";
}
</script>
