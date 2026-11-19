import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "mcp/dist/**", "next-env.d.ts"] },
];

export default config;
