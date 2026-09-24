<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { type ContactInput, contactSchema } from '#shared/schemas/contact'

useSeoMeta({ title: 'Contact — Marketplace' })

const toast = useToast()
const pending = ref(false)

const state = reactive<ContactInput>({ name: '', email: '', subject: '', message: '' })

async function onSubmit(event: FormSubmitEvent<ContactInput>) {
  pending.value = true
  try {
    await $fetch('/api/contact', { method: 'POST', body: event.data })
    toast.add({
      title: 'Message sent',
      description: 'We’ll get back to you soon.',
      color: 'success',
    })
    state.name = ''
    state.email = ''
    state.subject = ''
    state.message = ''
  } catch {
    toast.add({
      title: 'Failed to send message',
      description: 'Please try again in a moment.',
      color: 'error',
    })
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <UContainer class="max-w-2xl py-10">
    <h1 class="sr-only">Contact us</h1>
    <UPageCard
      title="Contact us"
      description="Questions, feedback or issues — we’d love to hear from you."
    >
      <UForm :schema="contactSchema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Name" name="name" required>
          <UInput v-model="state.name" autocomplete="name" class="w-full" />
        </UFormField>
        <UFormField label="Email" name="email" required>
          <UInput
            v-model="state.email"
            type="email"
            autocomplete="email"
            :spellcheck="false"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Subject" name="subject" required>
          <UInput v-model="state.subject" class="w-full" />
        </UFormField>
        <UFormField label="Message" name="message" required>
          <UTextarea v-model="state.message" :rows="6" class="w-full" />
        </UFormField>
        <UButton type="submit" :loading="pending">Send message</UButton>
      </UForm>
    </UPageCard>
  </UContainer>
</template>
