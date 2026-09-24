<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { type AddressInput, addressSchema } from '#shared/schemas/address'
import {
  type ChangePasswordInput,
  changePasswordSchema,
  type UpdateProfileInput,
  updateProfileSchema,
} from '#shared/schemas/profile'
import type { Address } from '#shared/types/db'

definePageMeta({ layout: 'default', middleware: 'auth' })

const toast = useToast()
const router = useRouter()
const { logout } = useAuth()

const { data: profile } = await useFetch('/api/profile')
const { data: addresses, refresh: refreshAddresses } =
  await useFetch<Address[]>('/api/profile/addresses')

const profileState = reactive<UpdateProfileInput>({ name: '', phone: '' })
watch(
  profile,
  (value) => {
    if (!value) return
    profileState.name = value.user.name
    profileState.phone = value.phone ?? ''
  },
  { immediate: true },
)

const profilePending = ref(false)
async function onProfileSubmit(event: FormSubmitEvent<UpdateProfileInput>) {
  profilePending.value = true
  try {
    await $fetch('/api/profile', { method: 'PATCH', body: event.data })
    toast.add({ title: 'Profile updated', color: 'success' })
  } finally {
    profilePending.value = false
  }
}

const passwordState = reactive<ChangePasswordInput>({ currentPassword: '', newPassword: '' })
const passwordPending = ref(false)
async function onPasswordSubmit(event: FormSubmitEvent<ChangePasswordInput>) {
  passwordPending.value = true
  try {
    await $fetch('/api/profile/password', { method: 'PATCH', body: event.data })
    toast.add({
      title: 'Password changed',
      description: 'Please log in again with your new password.',
      color: 'success',
    })
    await logout()
    await router.push('/login')
  } catch {
    toast.add({
      title: 'Failed to change password',
      description: 'Check your current password and try again.',
      color: 'error',
    })
  } finally {
    passwordPending.value = false
  }
}

const emptyAddress: AddressInput = {
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  phone: '',
  isDefault: false,
}

const showAddressModal = ref(false)
const editingAddressId = ref<string | null>(null)
const addressState = reactive<AddressInput>({ ...emptyAddress })
const addressPending = ref(false)

function openNewAddress() {
  editingAddressId.value = null
  Object.assign(addressState, emptyAddress)
  showAddressModal.value = true
}

function openEditAddress(address: Address) {
  editingAddressId.value = address.id
  Object.assign(addressState, {
    fullName: address.fullName,
    line1: address.line1,
    line2: address.line2 ?? '',
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
    isDefault: address.isDefault,
  })
  showAddressModal.value = true
}

async function onAddressSubmit(event: FormSubmitEvent<AddressInput>) {
  addressPending.value = true
  try {
    if (editingAddressId.value) {
      await $fetch(`/api/profile/addresses/${editingAddressId.value}`, {
        method: 'PATCH',
        body: event.data,
      })
    } else {
      await $fetch('/api/profile/addresses', { method: 'POST', body: event.data })
    }
    showAddressModal.value = false
    await refreshAddresses()
  } finally {
    addressPending.value = false
  }
}

const deletingAddress = ref<Address | null>(null)
const deletePending = ref(false)

function confirmDeleteAddress(addressToDelete: Address) {
  deletingAddress.value = addressToDelete
}

async function deleteAddress() {
  if (!deletingAddress.value) return
  deletePending.value = true
  try {
    await $fetch(`/api/profile/addresses/${deletingAddress.value.id}`, { method: 'DELETE' })
    deletingAddress.value = null
    await refreshAddresses()
  } finally {
    deletePending.value = false
  }
}
</script>

<template>
  <UContainer class="max-w-2xl py-10 space-y-8">
    <h1 class="text-2xl font-semibold">Your profile</h1>

    <UPageCard title="Personal information" description="Update your name and phone number.">
      <UForm
        :schema="updateProfileSchema"
        :state="profileState"
        class="space-y-4"
        @submit="onProfileSubmit"
      >
        <UFormField label="Name" name="name" required>
          <UInput v-model="profileState.name" class="w-full" />
        </UFormField>
        <UFormField label="Phone" name="phone">
          <UInput v-model="profileState.phone" class="w-full" />
        </UFormField>
        <UButton type="submit" :loading="profilePending">Save changes</UButton>
      </UForm>
    </UPageCard>

    <UPageCard
      title="Change password"
      description="You’ll be logged out on every device after this."
    >
      <UForm
        :schema="changePasswordSchema"
        :state="passwordState"
        class="space-y-4"
        @submit="onPasswordSubmit"
      >
        <UFormField label="Current password" name="currentPassword" required>
          <UInput
            v-model="passwordState.currentPassword"
            type="password"
            autocomplete="current-password"
            class="w-full"
          />
        </UFormField>
        <UFormField label="New password" name="newPassword" required>
          <UInput
            v-model="passwordState.newPassword"
            type="password"
            autocomplete="new-password"
            class="w-full"
          />
        </UFormField>
        <UButton type="submit" color="error" :loading="passwordPending">Change password</UButton>
      </UForm>
    </UPageCard>

    <UPageCard title="Addresses" description="Used at checkout for physical products.">
      <template #trailing>
        <UButton icon="i-lucide-plus" variant="subtle" @click="openNewAddress">Add address</UButton>
      </template>

      <p v-if="!addresses?.length" class="text-sm text-muted">No addresses saved yet.</p>
      <ul v-else class="space-y-3">
        <li
          v-for="address in addresses"
          :key="address.id"
          class="flex items-start justify-between gap-4 rounded-lg border border-default p-3"
        >
          <div class="text-sm">
            <p class="font-medium">
              {{ address.fullName }}
              <UBadge v-if="address.isDefault" size="sm" variant="subtle" class="ml-1"
                >Default</UBadge
              >
            </p>
            <p class="text-muted">
              {{ address.line1 }}<span v-if="address.line2">, {{ address.line2 }}</span>,
              {{ address.city }}, {{ address.state }} {{ address.postalCode }},
              {{ address.country }}
            </p>
            <p class="text-muted">{{ address.phone }}</p>
          </div>
          <div class="flex shrink-0 gap-1">
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              color="neutral"
              aria-label="Edit address"
              @click="openEditAddress(address)"
            />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              aria-label="Delete address"
              @click="confirmDeleteAddress(address)"
            />
          </div>
        </li>
      </ul>
    </UPageCard>

    <UModal
      v-model:open="showAddressModal"
      :title="editingAddressId ? 'Edit address' : 'Add address'"
    >
      <template #body>
        <UForm
          :schema="addressSchema"
          :state="addressState"
          class="space-y-4"
          @submit="onAddressSubmit"
        >
          <UFormField label="Full name" name="fullName" required>
            <UInput v-model="addressState.fullName" class="w-full" />
          </UFormField>
          <UFormField label="Address line 1" name="line1" required>
            <UInput v-model="addressState.line1" class="w-full" />
          </UFormField>
          <UFormField label="Address line 2" name="line2">
            <UInput v-model="addressState.line2" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="City" name="city" required>
              <UInput v-model="addressState.city" class="w-full" />
            </UFormField>
            <UFormField label="State" name="state" required>
              <UInput v-model="addressState.state" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Postal code" name="postalCode" required>
              <UInput v-model="addressState.postalCode" class="w-full" />
            </UFormField>
            <UFormField label="Country (2-letter code)" name="country" required>
              <UInput v-model="addressState.country" class="w-full" maxlength="2" />
            </UFormField>
          </div>
          <UFormField label="Phone" name="phone" required>
            <UInput v-model="addressState.phone" class="w-full" />
          </UFormField>
          <UCheckbox v-model="addressState.isDefault" label="Set as default address" />
          <UButton type="submit" :loading="addressPending">Save address</UButton>
        </UForm>
      </template>
    </UModal>

    <UModal :open="!!deletingAddress" title="Delete address" @update:open="deletingAddress = null">
      <template #body>
        <p class="text-sm text-muted">
          Delete the address for <strong>{{ deletingAddress?.fullName }}</strong>? This can’t be
          undone.
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <UButton color="neutral" variant="subtle" @click="deletingAddress = null">Cancel</UButton>
          <UButton color="error" :loading="deletePending" @click="deleteAddress"
            >Delete address</UButton
          >
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
