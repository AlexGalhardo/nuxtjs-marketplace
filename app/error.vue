<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

useHead({ htmlAttrs: { lang: 'en' } })
</script>

<template>
  <UApp>
    <UError :error="props.error" />
  </UApp>
</template>
