import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/src", { recursive: true });
await mkdir("dist/downloads", { recursive: true });
await cp("index.html", "dist/index.html");
await cp("service-worker.js", "dist/service-worker.js");
await cp("src", "dist/src", { recursive: true });
await cp("student", "dist/student", { recursive: true });
await cp("teacher", "dist/teacher", { recursive: true });
await cp("admin", "dist/admin", { recursive: true });
await cp("docs/presentations/704-class-system-role-guide.pptx", "dist/downloads/704-class-system-role-guide.pptx");
console.log("Static site built in dist/");
