<script setup lang="ts">
import '@scalar/api-reference/style.css'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useSeoMeta({ title: 'api docs — my shop' })

// Client-only and lazy: Scalar is a large bundle only this page needs.
const ApiReference = defineAsyncComponent(() =>
	import('@scalar/api-reference').then((module) => module.ApiReference),
)
const colorMode = useColorMode()
const configuration = computed(() => ({
	url: '/api/v1/openapi.json',
	// No third-party fonts, telemetry, AI agent or request proxy: nothing leaves our origin (CSP).
	withDefaultFonts: false,
	agent: { disabled: true },
	telemetry: false,
	hideClientButton: true,
	hideDarkModeToggle: true,
	showDeveloperTools: 'never' as const,
	forceDarkModeState: colorMode.value === 'dark' ? ('dark' as const) : ('light' as const),
}))
</script>

<template>
	<div class="rs-api-docs">
		<ClientOnly>
			<ApiReference :configuration="configuration" />
			<template #fallback>
				<div class="space-y-3 p-8">
					<USkeleton class="h-8 w-64" />
					<USkeleton class="h-4 w-full max-w-xl" />
					<USkeleton class="h-4 w-full max-w-lg" />
				</div>
			</template>
		</ClientOnly>
	</div>
</template>

<style scoped>
/* Scalar's own theme, pointed at resell.sh's fonts and terminal green. */
.rs-api-docs :deep(.scalar-app) {
	--scalar-font: var(--font-sans);
	--scalar-font-code: "JetBrains Mono", ui-monospace, monospace;
	--scalar-color-accent: var(--ui-primary);
}
</style>
