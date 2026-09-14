/* js/checkout/address-service.js */

export async function fetchAddressByCep(cep) {
    const cleanCep = String(cep).replace(/\D/g, '');

    if (cleanCep.length !== 8) {
        throw new Error('CEP inválido.');
    }

    const response = await fetch(
        `https://viacep.com.br/ws/${cleanCep}/json/`
    );

    if (!response.ok) {
        throw new Error(
            'Falha na requisição ao serviço de CEP.'
        );
    }

    const data = await response.json();

    if (data.erro) {
        throw new Error('CEP não encontrado.');
    }

    return {
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || ''
    };
}
