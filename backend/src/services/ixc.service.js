const axios = require('axios');

// Cliente da API REST do IXC Soft. Autenticação Basic Auth com "id_token:hash_token".
// Listagens: POST no recurso com header ixcsoft: listar.
function ixcClient() {
  const baseURL = process.env.IXC_BASE_URL;
  const token = process.env.IXC_TOKEN;
  if (!baseURL || !token) return null;
  return axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      Authorization: `Basic ${Buffer.from(token).toString('base64')}`,
      'Content-Type': 'application/json'
    }
  });
}

async function ixcList(resource, params) {
  const client = ixcClient();
  if (!client) throw new Error('Integração com o IXC não configurada.');
  const { data } = await client.post(resource, {
    oper: '=',
    page: '1',
    rp: '10',
    ...params
  }, { headers: { ixcsoft: 'listar' } });
  return data.registros || [];
}

function formatarCpf(cpf) {
  const digits = cpf.replace(/\D/g, '');
  return digits.length === 11
    ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
    : digits;
}

async function buscarClientePorCpf(cpf) {
  const registros = await ixcList('/cliente', {
    qtype: 'cliente.cnpj_cpf',
    query: formatarCpf(cpf),
    oper: '='
  });
  return registros[0] || null;
}

// Identifica o cliente só pelo CPF — sem senha. O hotspot é liberado a
// qualquer assinante cadastrado no IXC, sem exigir a senha do app/hotsite.
async function identificarClientePorCpf(cpf) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) throw new Error('CPF inválido. Confira os 11 dígitos.');

  const cliente = await buscarClientePorCpf(digits);
  if (!cliente) throw new Error('CPF não encontrado. Verifique os dados ou fale com o suporte da Inforcenter.');

  return {
    id: cliente.id,
    nome: cliente.razao,
    cpf: digits,
    email: cliente.email || ''
  };
}

module.exports = { identificarClientePorCpf, buscarClientePorCpf };
