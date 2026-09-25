// The server's createError statusMessage from a failed $fetch, or a fallback.
export function apiErrorMessage(
	error: unknown,
	fallback = 'something went wrong, try again',
): string {
	return (error as { data?: { statusMessage?: string } } | null)?.data?.statusMessage ?? fallback
}
