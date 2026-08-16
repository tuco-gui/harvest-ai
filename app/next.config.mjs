/** @type {import('next').NextConfig} */
export default {
  // standalone deixa a imagem Docker pequena: só o que o app usa
  output: 'standalone',
  reactStrictMode: true,
  // Evita erro de ENOENT no 500.html durante build standalone
  experimental: {
    outputFileTracingRoot: process.cwd(),
  },
};
