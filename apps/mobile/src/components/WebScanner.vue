<script setup lang="ts">
/**
 * Scanner de développement pour navigateur : caméra arrière + décodage jsQR.
 * Sur mobile, l'application utilise le scanner natif ML Kit.
 */
import jsQR from "jsqr";
import { onBeforeUnmount, onMounted, ref } from "vue";

const emit = defineEmits<{ decode: [value: string]; error: [message: string] }>();
const video = ref<HTMLVideoElement | null>(null);
const canvas = document.createElement("canvas");
let stream: MediaStream | null = null;
let frame = 0;
let last = 0;
let active = true;

function loop(time: number) {
  if (!active) return;
  frame = requestAnimationFrame(loop);
  const v = video.value;
  if (!v || v.readyState < 2 || time - last < 150) return;
  last = time;
  canvas.width = v.videoWidth;
  canvas.height = v.videoHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(v, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
  if (code?.data) emit("decode", code.data);
}

onMounted(async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    if (video.value) {
      video.value.srcObject = stream;
      await video.value.play();
    }
    frame = requestAnimationFrame(loop);
  } catch {
    emit("error", "Caméra indisponible. Autorisez l'accès ou saisissez le contenu du QR.");
  }
});

onBeforeUnmount(() => {
  active = false;
  cancelAnimationFrame(frame);
  stream?.getTracks().forEach((t) => t.stop());
});
</script>

<template>
  <div class="camera">
    <video ref="video" playsinline muted />
    <div class="frame" />
  </div>
</template>

<style scoped>
.camera {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  background: #000;
  aspect-ratio: 3 / 4;
  max-height: 60vh;
}

video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.frame {
  position: absolute;
  inset: 18%;
  border: 3px solid rgba(255, 255, 255, 0.85);
  border-radius: 18px;
  box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.35);
}
</style>
