import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["node_modules/**", "out/**", "build/**", "dist-extension/**", "public/companion/**", "docs/**", "assets/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { "react-hooks": hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
