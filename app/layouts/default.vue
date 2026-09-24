<template>
	<div class="flex min-h-svh flex-col">
		<a
			href="#main"
			class="sr-only z-50 rounded-full bg-primary px-4 py-2 font-bold text-inverted focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
		>
			skip to content
		</a>
		<AppHeader />
		<main id="main" class="flex-1">
			<slot />
		</main>
		<AppFooter />
	</div>
</template>
