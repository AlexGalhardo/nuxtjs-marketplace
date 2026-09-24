<script setup lang="ts">
const { loggedIn, user, logout } = useAuth()
const router = useRouter()

const userMenuItems = computed(() => [
  [{ label: 'Profile', icon: 'i-lucide-user', to: '/profile' }],
  [
    {
      label: 'Log out',
      icon: 'i-lucide-log-out',
      onSelect: async () => {
        await logout()
        await router.push('/')
      },
    },
  ],
])
</script>

<template>
  <div>
    <UHeader>
      <template #left>
        <NuxtLink to="/" class="focus-visible:outline-3 outline-primary/25 rounded-md p-1 -ms-1">
          <AppLogo class="w-auto h-6 shrink-0" />
        </NuxtLink>
      </template>

      <template #right>
        <UColorModeButton />

        <template v-if="loggedIn">
          <UDropdownMenu :items="userMenuItems">
            <UButton
              :label="user?.name"
              trailing-icon="i-lucide-chevron-down"
              color="neutral"
              variant="ghost"
            />
          </UDropdownMenu>
        </template>
        <template v-else>
          <UButton to="/login" color="neutral" variant="ghost">Log in</UButton>
          <UButton to="/signup" color="primary">Sign up</UButton>
        </template>

        <UButton
          to="https://github.com/AlexGalhardo/nuxtjs-marketplace"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UHeader>

    <UMain>
      <slot />
    </UMain>

    <USeparator icon="i-simple-icons-nuxtdotjs" />

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">Built with Nuxt UI • © {{ new Date().getFullYear() }}</p>
      </template>

      <template #right>
        <UButton
          to="https://github.com/AlexGalhardo/nuxtjs-marketplace"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UFooter>
  </div>
</template>
