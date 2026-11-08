// Dashboards reference the bare global `app` (Obsidian exposes it as a
// window global, never passed into the codeblock explicitly — see
// `dc`/`h`/`Fragment` being the only names Datacore injects). Install this on
// `globalThis.app` for the duration of a test, e.g. via a `beforeEach`.
export function createMockApp({ files = {} } = {}) {
    return {
        vault: {
            getAbstractFileByPath: (path) => (path in files ? { path } : null),
            process: async (file, transform) => {
                files[file.path] = transform(files[file.path] ?? "");
                return files[file.path];
            },
            read: async (file) => files[file.path] ?? "",
        },
        __files: files,
    };
}
