export async function criarTransacaoPix(dadosPedido) {
  // Exemplo de payload enviado para seu backend/API gateway
  const response = await fetch('/api/payments/pix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosPedido)
  });
  return await response.json(); // Retorna qr_code, qr_code_base64 e id_transacao
}
// js/checkout/payment-service.js

// Inicializa a SDK com a sua Public Key (substitua pela sua chave pública)
const mp = new MercadoPago('PUBLIC_KEY_SEU_MERCADO_PAGO');

/**
 * Gerar cobrança via PIX
 * Envia os dados do comprador para o backend processar a cobrança via API do Mercado Pago
 */
export async function processarPagamentoPix(dadosComprador, itensCarrinho) {
  try {
    const response = await fetch('/api/pagamentos/pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payer: dadosComprador, // email, cpf, primeiro_nome, sobrenome
        items: itensCarrinho
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erro ao gerar PIX');

    // Retorna os dados do QR Code para exibição na tela
    return {
      transactionId: data.id,
      qrCode: data.point_of_interaction.transaction_data.qr_code, // Chave "Copia e Cola"
      qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64 // Imagem do QR Code
    };
  } catch (error) {
    console.error('Erro no checkout PIX:', error);
    throw error;
  }
}

/**
 * Processar pagamento via Cartão de Crédito utilizando Tokenização
 */
export async function processarPagamentoCartao(dadosCartao, dadosComprador, valorTotal) {
  try {
    // 1. Gera o Token do Cartão com segurança através do SDK client-side
    const cardToken = await mp.createCardToken({
      cardNumber: dadosCartao.numero,
      cardholderName: dadosCartao.nome,
      cardExpirationMonth: dadosCartao.mesExpiracao,
      cardExpirationYear: dadosCartao.anoExpiracao,
      securityCode: dadosCartao.cvv,
      identificationType: 'CPF',
      identificationNumber: dadosComprador.cpf
    });

    // 2. Envia o token gerado para o backend concluir a cobrança
    const response = await fetch('/api/pagamentos/cartao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: cardToken.id,
        paymentMethodId: dadosCartao.bandeira, // ex: 'visa', 'master'
        installments: Number(dadosCartao.parcelas),
        payer: dadosComprador,
        transactionAmount: valorTotal
      })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Erro no processamento do cartão:', error);
    throw error;
  }
}
// js/checkout/payment-service.js

/**
 * Criar cobrança via PIX no Asaas
 */
export async function processarPixAsaas(dadosCliente, valorTotal) {
  try {
    const response = await fetch('/api/asaas/pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          name: dadosCliente.nomeCompleto,
          cpfCnpj: dadosCliente.cpf,
          email: dadosCliente.email,
          mobilePhone: dadosCliente.telefone
        },
        value: valorTotal,
        description: 'Pedido Fios Perfeitos / Shine Express'
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erro ao gerar PIX no Asaas');

    return {
      paymentId: data.id,
      payload: data.pixQrCode.payload, // Chave "Copia e Cola"
      encodedImage: data.pixQrCode.encodedImage // Imagem Base64 do QR Code
    };
  } catch (error) {
    console.error('Erro Asaas PIX:', error);
    throw error;
  }
}