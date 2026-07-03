(async () => {
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");

  const localBin = join(__dirname, "..", "node_modules", ".bin");
  const prismaCli = process.platform === "win32" ? "prisma.cmd" : "prisma";
  const prismaPath = join(localBin, prismaCli);

  if (!existsSync(prismaPath)) {
    console.log("Skipping Prisma client generation: Prisma CLI is not installed.");
    process.exit(0);
  }

  const result = spawnSync("npm", ["run", "prisma:generate"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
})();
