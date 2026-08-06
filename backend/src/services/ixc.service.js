const axios = require('axios');
const crypto = require('crypto');

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

function md5(value) {
  return crypto.createHash('md5').update(value, 'utf8').digest('hex');
}

async function buscarClientePorCpf(cpf) {
  const registros = await ixcList('/cliente', {
    qtype: 'cliente.cnpj_cpf',
    query: formatarCpf(cpf),
    oper: '='
  });
  return registros[0] || null;
}

async function buscarClientePorCpfESenha(cpf, senha) {
  const registros = await ixcList('/cliente', {
    qtype: 'cliente.cnpj_cpf',
    query: formatarCpf(cpf),
    oper: '=',
    grid_param: JSON.stringify([{ TB: 'cliente.senha', OP: '=', P: senha }])
  });
  return registros[0] || null;
}

// Mesma regra do app do assinante: senha em texto puro, depois MD5, depois
// senha padrão do primeiro acesso (5 primeiros dígitos do CPF) para quem
// nunca cadastrou senha no hotsite.
async function autenticarCliente(cpf, senha) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) throw new Error('CPF inválido. Confira os 11 dígitos.');
  if (!senha) throw new Error('Informe sua senha.');

  const existe = await buscarClientePorCpf(digits);
  if (!existe) throw new Error('CPF não encontrado. Verifique os dados ou fale com o suporte da Inforcenter.');

  let cliente = await buscarClientePorCpfESenha(digits, senha);
  if (!cliente) cliente = await buscarClientePorCpfESenha(digits, md5(senha));

  if (!cliente) {
    const senhaPadrao = digits.slice(0, 5);
    if (senha === senhaPadrao) {
      cliente = await buscarClientePorCpfESenha(digits, '');
    }
  }

  if (!cliente) {
    throw new Error('Senha incorreta. No primeiro acesso, use os 5 primeiros dígitos do seu CPF (a mesma senha do app Inforcenter).');
  }

  return {
    id: cliente.id,
    nome: cliente.razao,
    cpf: digits,
    email: cliente.email || ''
  };
}

module.exports = { autenticarCliente, buscarClientePorCpf };
