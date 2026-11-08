import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        // @testing-library/preact only wires up its auto-cleanup afterEach
        // hook when it finds a global `afterEach`.
        globals: true,
    },
});
