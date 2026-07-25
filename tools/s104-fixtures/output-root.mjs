import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = dirname(dirname(scriptDirectory));

export const resolveS104FixtureOutputRoot = () => {
  if (process.env.S104_FIXTURE_OUTPUT_DIR) {
    return process.env.S104_FIXTURE_OUTPUT_DIR;
  }

  const staticFilesOutputRoot = join(
    workspaceRoot,
    "../../local/worktrees/S100ViewerStatic-static-assets/static/testdata/s104-fixtures/service",
  );

  if (existsSync(dirname(dirname(staticFilesOutputRoot)))) {
    return staticFilesOutputRoot;
  }

  return join(workspaceRoot, "local/generated/s104-fixtures/service");
};
