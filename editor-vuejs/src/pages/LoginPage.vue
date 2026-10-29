<script setup lang="ts">
import { GoogleLogin } from "vue3-google-login";
import { onMounted } from "vue";
import { useUrlSearchParams } from "@vueuse/core";
//@ts-ignore
import { loginGoogle } from "shared-vuejs/api/socket-client";
import g from "shared-vuejs/api/global";
import LoginButton from "./LoginButton.vue";
// import { GoogleSignInButton } from "vue3-google-signin";

// const host = ref(location.origin);

const handleLoginSuccess = (response) => {
  // decodeCredential will retrive the JWT payload from the credential
  // const userData = decodeCredential(response.credential);
  // console.log("Handle the userData", userData);
  // check server validation, then save password
  sessionStorage.setItem("GTK", response.credential);
  loginGoogle(g.socket, response.credential);
  // loggedIn.value = true;
};

const handleLoginError = () => {
  console.error("Login failed");
};

onMounted(() => {
  const params = useUrlSearchParams();
  console.log(params);
});
</script>

<template>
  <LoginButton />
  <GoogleLogin
    :autoLogin="false"
    :onNotification="
      (s) => {
        console.log(s);
      }
    "
    :callback="handleLoginSuccess"
  ></GoogleLogin>
  <div class="guide">
    (NOTE: if this dialog doesn't refresh after login, try reload the web page)
  </div>
  <!-- <GoogleSignInButton
    @success="handleLoginSuccess"
    @error="handleLoginError"
  ></GoogleSignInButton> -->
</template>
<style scoped>
.guide {
  font-style: italic;
  font-size: 12px;
}
</style>
