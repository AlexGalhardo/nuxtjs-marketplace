<script setup lang="ts">
useHead({
	meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
	link: [{ rel: 'icon', href: '/favicon.ico' }],
	htmlAttrs: {
		lang: 'en',
	},
})

// Browser chrome (mobile address bar) matches the promo bar at the top of every page.
const colorMode = useColorMode()
useHead({
	meta: [
		{
			name: 'theme-color',
			content: computed(() => (colorMode.value === 'dark' ? '#022e14' : '#3dff7a')),
		},
	],
})

const title = 'Marketplace'
const description = 'Buy and sell physical and digital products.'

useHead({
	titleTemplate: (pageTitle) => (pageTitle && pageTitle !== title ? pageTitle : title),
})

useSeoMeta({
	title,
	description,
	ogTitle: title,
	ogDescription: description,
	ogType: 'website',
	twitterCard: 'summary_large_image',
})
</script>

<template>
	<UApp>
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>
