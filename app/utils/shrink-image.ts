// Phone photos arrive at 3–12 MB and ~4000px, but the largest slot on the site is ~1200px wide.
// Downscale in the browser before uploading (native canvas, no image dependency). Anything this
// can't decode or improve (GIFs, SVGs, already-small files) is uploaded untouched.
export async function shrinkImage(file: File, maxEdge = 1600): Promise<File> {
	if (!/^image\/(jpeg|png|webp)$/.test(file.type) || typeof OffscreenCanvas === 'undefined') {
		return file
	}
	// createImageBitmap applies the EXIF orientation, so rotated phone photos stay upright.
	const bitmap = await createImageBitmap(file).catch(() => null)
	if (!bitmap) return file
	const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
	const canvas = new OffscreenCanvas(
		Math.round(bitmap.width * scale),
		Math.round(bitmap.height * scale),
	)
	canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
	bitmap.close()
	const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 }).catch(() => null)
	// Same dimensions: only worth it if the bytes shrank. Downscaled: always (decode cost is in pixels).
	if (!blob || (scale === 1 && blob.size >= file.size)) return file
	return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' })
}
