import { fileURLToPath } from 'node:url';

const buildCpus = Number(process.env.HARVEST_BUILD_CPUS);

/** @type {import('next').NextConfig} */
export default {
  // standalone deixa a imagem Docker pequena: só o que o app usa
  output: 'standalone',
  // Não expandir o tracing para lockfiles de outros projetos no diretório pai.
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  reactStrictMode: true,
  // Opt-in para verificações em máquinas com pouca memória. Sem efeito nos envios.
  ...(Number.isSafeInteger(buildCpus) && buildCpus > 0
    ? { experimental: { cpus: buildCpus } }
    : {}),
};
