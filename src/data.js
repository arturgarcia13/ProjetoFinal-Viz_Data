/**
 * Decodificação da base analítica validada (sem PII) e utilitários de filtro.
 */

export const CARGO_LABEL = {
  all: 'Federal + Estadual',
  '6': 'Deputado Federal',
  '7': 'Deputado Estadual',
};

export const UF_NAMES = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará',
  PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
};

const DICT_FIELDS = new Set(['race', 'p', 'fed', 'chapa', 'uf', 'cargo', 'tpConta']);

export function decodeAnalyticalBase(raw) {
  const schema = raw.meta.schema;
  const dicts = raw.dict;
  const candidates = raw.candidates.map((row) => {
    const obj = {};
    for (let i = 0; i < schema.length; i += 1) {
      const key = schema[i];
      const val = row[i];
      obj[key] = DICT_FIELDS.has(key) ? dicts[key][val] : val;
    }
    return obj;
  });
  return { meta: raw.meta, candidates };
}

export function filterCandidates(candidates, filters = {}) {
  const {
    year = 2022,
    cargo = 'all',
    uf = null,
    party = null,
    parties = null,
  } = filters;

  return candidates.filter((c) => {
    if (year != null && c.y !== year) return false;
    if (cargo && cargo !== 'all' && c.cargo !== cargo) return false;
    if (uf && c.uf !== uf) return false;
    if (party && c.p !== party) return false;
    if (parties && parties.size > 0 && !parties.has(c.p)) return false;
    return true;
  });
}

export async function loadAppData() {
  const [rawBase, networkHubs, coverage, brUf] = await Promise.all([
    fetch('data/analytical_base.json').then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} em data/analytical_base.json`);
      return r.json();
    }),
    fetch('data/network_hubs.json').then((r) => (r.ok ? r.json() : { years: {} })),
    fetch('data/coverage.json').then((r) => (r.ok ? r.json() : { years: {} })),
    fetch('data/br_uf.json').then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} em data/br_uf.json`);
      return r.json();
    }),
  ]);

  const { meta, candidates } = decodeAnalyticalBase(rawBase);
  return { meta, candidates, networkHubs, coverage, brUf };
}
