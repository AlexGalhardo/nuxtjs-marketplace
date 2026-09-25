<script setup lang="ts">
const props = defineProps<{ orderItemId: string; title: string }>()
const emit = defineEmits<{ reviewed: [] }>()

const rating = ref(0)
const comment = ref('')
const pending = ref(false)
const error = ref('')
const toast = useToast()
const hints = ['', 'bad', 'meh', 'ok', 'good', 'loved it']

async function submit() {
	if (!rating.value) {
		error.value = 'pick a rating first'
		return
	}
	pending.value = true
	error.value = ''
	try {
		await $fetch('/api/reviews', {
			method: 'POST',
			body: {
				orderItemId: props.orderItemId,
				rating: rating.value,
				comment: comment.value.trim() || undefined,
			},
		})
		toast.add({ title: 'thanks for the review', color: 'success', icon: 'i-lucide-star' })
		emit('reviewed')
	} catch (caught) {
		error.value = apiErrorMessage(caught)
	} finally {
		pending.value = false
	}
}
</script>

<template>
	<form class="flex flex-col gap-3 rounded-lg bg-muted p-4" @submit.prevent="submit">
		<fieldset>
			<legend class="text-sm font-semibold text-highlighted">rate {{ title }}</legend>
			<div class="mt-1 flex items-center gap-1">
				<label
					v-for="star in 5"
					:key="star"
					class="flex size-10 cursor-pointer items-center justify-center rounded-md has-focus-visible:outline-2 has-focus-visible:outline-primary"
				>
					<input
						v-model="rating"
						type="radio"
						:name="`rating-${orderItemId}`"
						:value="star"
						class="sr-only"
					>
					<span class="sr-only">{{ star }} {{ star === 1 ? 'star' : 'stars' }}</span>
					<UIcon
						name="i-lucide-star"
						class="size-6 transition-colors"
						:class="star <= rating ? 'text-primary' : 'text-dimmed'"
					/>
				</label>
				<span class="ms-2 text-sm text-muted" aria-hidden="true">{{ hints[rating] }}</span>
			</div>
		</fieldset>
		<div>
			<label :for="`comment-${orderItemId}`" class="text-sm font-semibold text-highlighted"
				>anything to add? <span class="font-normal text-muted">(optional)</span></label
			>
			<UTextarea
				:id="`comment-${orderItemId}`"
				v-model="comment"
				:rows="2"
				:maxlength="1000"
				autoresize
				class="mt-1 w-full"
			/>
		</div>
		<p v-if="error" class="text-sm font-semibold text-error" role="alert">{{ error }}</p>
		<UButton type="submit" :loading="pending" class="self-start">post review</UButton>
	</form>
</template>
