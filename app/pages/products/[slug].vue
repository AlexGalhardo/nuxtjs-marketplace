<script setup lang="ts">
import type { ProductKind } from '#shared/types/enums'

interface ProductPage {
	id: string
	slug: string
	title: string
	description: string
	kind: ProductKind
	priceCents: number
	shippingCents: number
	stock: number | null
	ratingAvg: number | null
	ratingCount: number
	createdAt: string
	type: { slug: string; name: string }
	shop: { slug: string; name: string; logoPath: string | null }
	images: { id: string; blobPath: string; alt: string | null }[]
	reviews: {
		id: string
		rating: number
		comment: string | null
		buyerName: string
		createdAt: string
	}[]
}

const route = useRoute()
const slug = computed(() => String(route.params.slug))
const { data: product, error } = await useFetch<ProductPage>(() => `/api/products/${slug.value}`)
if (error.value || !product.value) {
	throw createError({ statusCode: 404, statusMessage: 'Product not found', fatal: true })
}
const item = computed(() => product.value as ProductPage)

const active = ref(0)
watch(slug, () => {
	active.value = 0
})
const photo = computed(() => item.value.images[active.value] ?? null)

const soldOut = computed(() => item.value.kind === 'physical' && item.value.stock === 0)

const { cart, add } = useCart()
const toast = useToast()
const adding = ref(false)
const inCart = computed(() =>
	cart.value?.groups.some((group) =>
		group.lines.some((line) => line.productId === item.value.id),
	),
)
async function addToCart() {
	adding.value = true
	try {
		if (await add(item.value.id)) {
			toast.add({
				title: 'added to your cart',
				color: 'success',
				icon: 'i-lucide-shopping-bag',
			})
		}
	} catch (error) {
		toast.add({
			title: 'could not add it',
			description: apiErrorMessage(error),
			color: 'error',
		})
	} finally {
		adding.value = false
	}
}
const shippingLabel = computed(() => {
	if (item.value.kind === 'digital') return 'instant download after checkout'
	return item.value.shippingCents === 0
		? 'free shipping'
		: `+ ${formatMoney(item.value.shippingCents)} flat shipping`
})
const stockLabel = computed(() => {
	const { kind, stock } = item.value
	if (kind === 'digital' || stock === null) return null
	if (stock === 0) return 'sold out'
	return stock === 1 ? 'only one left' : `${stock} in stock`
})

useSeoMeta({
	title: () => item.value.title,
	description: () => item.value.description.slice(0, 160),
	ogImage: () => (photo.value ? mediaUrl(photo.value.blobPath) : undefined),
})
</script>

<template>
	<div class="rs-container py-6">
		<UBreadcrumb
			:items="[
				{ label: 'home', to: '/' },
				{ label: item.type.name, to: { path: '/marketplace', query: { type: item.type.slug } } },
				{ label: item.title },
			]"
			class="mb-6"
			:ui="{ link: 'text-base font-medium', list: 'min-w-0', item: 'min-w-0', linkLabel: 'truncate' }"
		/>

		<div class="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
			<section aria-label="photos" class="flex flex-col-reverse gap-3 sm:flex-row">
				<ul
					v-if="item.images.length > 1"
					class="flex shrink-0 gap-2 overflow-x-auto sm:w-20 sm:flex-col"
					aria-label="all photos"
				>
					<li v-for="(image, index) in item.images" :key="image.id">
						<button
							type="button"
							class="block size-16 overflow-hidden rounded-md ring-2 ring-transparent hover:ring-accented data-[active=true]:ring-primary sm:size-20"
							:data-active="index === active"
							:aria-pressed="index === active"
							:aria-label="`show photo ${index + 1} of ${item.images.length}`"
							@click="active = index"
						>
							<img
								:src="mediaUrl(image.blobPath)"
								alt=""
								width="80"
								height="80"
								loading="lazy"
								class="size-full object-cover"
							>
						</button>
					</li>
				</ul>
				<div
					class="@container relative aspect-square flex-1 overflow-hidden rounded-lg bg-muted"
				>
					<ProductPhoto
						:src="photo?.blobPath ?? null"
						:alt="photo?.alt"
						:title="item.title"
						:kind="item.kind"
						eager
					/>
				</div>
			</section>

			<section
				aria-labelledby="product-title"
				class="flex flex-col gap-6 md:sticky md:top-36 md:self-start"
			>
				<div>
					<h1
						id="product-title"
						class="text-[2rem] leading-10 font-semibold text-balance wrap-break-word text-highlighted"
					>
						{{ item.title }}
					</h1>
					<p class="mt-3 text-[2rem] leading-10 font-bold text-highlighted tabular-nums">
						{{ formatMoney(item.priceCents) }}
					</p>
					<p class="mt-1 font-medium text-muted">{{ shippingLabel }}</p>
				</div>

				<div class="flex flex-col gap-2">
					<UButton
						v-if="inCart"
						size="xl"
						block
						variant="outline"
						to="/cart"
						trailing-icon="i-lucide-arrow-right"
						label="in your cart · check out"
					/>
					<UButton
						v-else
						size="xl"
						block
						:disabled="soldOut"
						:loading="adding"
						:label="soldOut ? 'sold out' : 'add to cart'"
						@click="addToCart"
					/>
				</div>

				<ul class="flex flex-wrap gap-2 text-sm font-semibold">
					<li class="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
						<UIcon :name="productTypeIcon(item.type.slug)" class="size-4" />
						{{ item.type.name }}
					</li>
					<li
						class="flex items-center gap-1.5 rounded-full px-3 py-1.5"
						:class="item.kind === 'digital' ? 'bg-(--rs-signal) text-(--rs-signal-ink)' : 'bg-muted'"
					>
						<UIcon
							:name="item.kind === 'digital' ? 'i-lucide-download' : 'i-lucide-package'"
							class="size-4"
						/>
						{{ item.kind }}
					</li>
					<li v-if="stockLabel" class="rounded-full bg-muted px-3 py-1.5">
						{{ stockLabel }}
					</li>
				</ul>

				<p
					v-if="item.ratingCount"
					class="flex items-center gap-1.5 font-semibold text-highlighted"
				>
					<UIcon name="i-lucide-star" class="size-5 text-primary" />
					<span class="tabular-nums">{{ (item.ratingAvg ?? 0).toFixed(1) }}</span>
					<a href="#reviews" class="font-medium text-muted hover:text-primary">
						· {{ item.ratingCount }} {{ item.ratingCount === 1 ? 'review' : 'reviews' }}
					</a>
				</p>
				<p v-else class="font-medium text-muted">no reviews yet.</p>

				<NuxtLink
					:to="`/shops/${item.shop.slug}`"
					class="group flex items-center gap-3 rounded-xl p-3 ring-1 ring-default hover:bg-muted"
				>
					<img
						v-if="item.shop.logoPath"
						:src="mediaUrl(item.shop.logoPath)"
						alt=""
						width="48"
						height="48"
						class="size-12 rounded-full object-cover"
					>
					<span
						v-else
						class="flex size-12 items-center justify-center rounded-full bg-(--rs-selected) font-display text-xl font-black text-(--rs-selected-ink)"
						aria-hidden="true"
						>{{
							item.shop.name.charAt(0)
						}}</span
					>
					<span class="min-w-0 flex-1">
						<span class="block text-sm text-muted">sold by</span>
						<span
							class="block truncate font-bold text-highlighted group-hover:text-primary"
						>
							{{ item.shop.name }}
						</span>
					</span>
					<UIcon name="i-lucide-chevron-right" class="size-5 text-muted" />
				</NuxtLink>

				<div>
					<h2 class="text-xl font-semibold text-highlighted">about this one</h2>
					<p class="mt-2 max-w-prose whitespace-pre-line text-toned">
						{{ item.description }}
					</p>
				</div>

				<div v-if="item.reviews.length" id="reviews">
					<h2 class="text-xl font-semibold text-highlighted">what buyers said</h2>
					<ul class="mt-2 divide-y divide-default">
						<li v-for="review in item.reviews" :key="review.id" class="py-3">
							<p class="flex items-center gap-2 text-sm">
								<span
									class="flex gap-0.5"
									role="img"
									:aria-label="`${review.rating} out of 5 stars`"
								>
									<UIcon
										v-for="star in 5"
										:key="star"
										name="i-lucide-star"
										class="size-4"
										:class="star <= review.rating ? 'text-primary' : 'text-dimmed'"
									/>
								</span>
								<span class="font-semibold text-highlighted">{{
									review.buyerName
								}}</span>
								<span class="text-muted">· {{ formatDate(review.createdAt) }}</span>
							</p>
							<p v-if="review.comment" class="mt-1 max-w-prose text-toned">
								{{ review.comment }}
							</p>
						</li>
					</ul>
				</div>
			</section>
		</div>
	</div>
</template>
