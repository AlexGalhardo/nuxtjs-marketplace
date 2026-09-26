import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupCep } from '../../../app/utils/postal-code'

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)
afterEach(() => fetchMock.mockReset())

describe('lookupCep', () => {
	it('maps a ViaCEP hit to address fields and strips the mask', async () => {
		fetchMock.mockResolvedValue({
			logradouro: 'Praça da Sé',
			bairro: 'Sé',
			localidade: 'São Paulo',
			uf: 'SP',
		})
		await expect(lookupCep('01001-000')).resolves.toEqual({
			line1: 'Praça da Sé',
			line2: 'Sé',
			city: 'São Paulo',
			state: 'SP',
		})
		expect(fetchMock).toHaveBeenCalledWith('https://viacep.com.br/ws/01001000/json/')
	})

	it('returns null for an unknown CEP (ViaCEP answers {"erro": "true"})', async () => {
		fetchMock.mockResolvedValue({ erro: 'true' })
		await expect(lookupCep('99999999')).resolves.toBeNull()
	})

	it('does not call ViaCEP until there are 8 digits', async () => {
		await expect(lookupCep('0100100')).resolves.toBeNull()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('returns null when ViaCEP is unreachable, so the form stays editable', async () => {
		fetchMock.mockRejectedValue(new Error('offline'))
		await expect(lookupCep('01001000')).resolves.toBeNull()
	})
})
