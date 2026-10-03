import type { H3Event } from 'h3'

// readFormData() throws a TypeError on a body that isn't multipart (JSON, a broken boundary), which
// surfaced as a 500. That is the client's mistake: answer 400 (found by the QA fuzz suite).
export async function readUploadForm(event: H3Event): Promise<FormData> {
	try {
		return await readFormData(event)
	} catch {
		throw createError({
			statusCode: 400,
			statusMessage: 'Send the file as multipart/form-data',
		})
	}
}
