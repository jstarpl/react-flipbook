import { defineConfig } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { libInjectCss } from "vite-plugin-lib-inject-css";
import flipbook from "@jstarpl/rollup-plugin-flipbook";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react(), libInjectCss(), dts({ include: ["lib"] }), flipbook()],
	resolve: {
		alias: [
			{
				find: "@components",
				replacement: fileURLToPath(new URL("./lib", import.meta.url)),
			},
		],
	},
	build: {
		copyPublicDir: false,
		lib: {
			entry: resolve(__dirname, "lib/main.ts"),
			formats: ["es"],
		},
		rollupOptions: {
			external: ["react", "react/jsx-runtime"],
		},
	},
});
