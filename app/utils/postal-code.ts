export interface CepAddress {
	line1: string
	line2: string
	city: string
	state: string
}

interface ViaCepResponse {
	logradouro?: string
	bairro?: string
	localidade?: string
	uf?: string
	erro?: boolean | string
}

// ViaCEP (https://viacep.com.br): free, keyless Brazilian postal-code lookup with open CORS.
// Returns null for incomplete, unknown or unreachable lookups; the form stays editable either way.
export async function lookupCep(cep: string): Promise<CepAddress | null> {
	const digits = cep.replace(/\D/g, '')
	if (digits.length !== 8) return null
	const data = await $fetch<ViaCepResponse>(`https://viacep.com.br/ws/${digits}/json/`).catch(
		() => null,
	)
	if (!data || data.erro) return null
	return {
		line1: data.logradouro ?? '',
		line2: data.bairro ?? '',
		city: data.localidade ?? '',
		state: data.uf ?? '',
	}
}
