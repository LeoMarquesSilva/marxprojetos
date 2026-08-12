import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

const guardedActions = {
  "src/app/actions/crm.ts": [
    "getCrmClients",
    "getCrmDashboardSummary",
    "getCrmUnreadConversationCount",
    "getCrmBoardClients",
    "getCrmClient",
    "createCrmClient",
    "createAndLinkCrmClientFromChat",
    "updateCrmClientStage",
    "updateCrmClient",
    "getLinkableProjects",
    "linkCrmClientProject",
    "deleteCrmClient",
    "updateCrmNextStep",
  ],
  "src/app/actions/projects.ts": [
    "getTemplates",
    "getProjects",
    "getDashboardProjectSummary",
    "getProject",
    "createProject",
    "updateProjectStatus",
    "updateProjectQuestions",
  ],
  "src/app/actions/prospecting.ts": [
    "getProspects",
    "getProspectingTemplate",
    "saveProspectingTemplate",
    "searchPlaces",
    "refreshEnrichment",
    "updateProspectStatus",
    "updateProspectMessage",
    "deleteProspect",
    "personalizeMessage",
    "promoteToCrm",
    "sendProspectToConversas",
    "importProspectsCsv",
  ],
  "src/app/actions/review.ts": [
    "enableSiteReview",
    "getSitesOverview",
    "getProjectComments",
    "resolveComment",
  ],
};

const publicReviewActions = [
  "fetchReviewByToken",
  "listReviewComments",
  "addReviewComment",
  "approveReview",
];

function getFunctionBody(source, name) {
  const declaration = `export async function ${name}`;
  const declarationIndex = source.indexOf(declaration);
  assert.notEqual(declarationIndex, -1, `${name} deve continuar exportada`);

  const parametersStart = source.indexOf("(", declarationIndex);
  assert.notEqual(parametersStart, -1, `${name} deve declarar parâmetros`);

  let parenthesesDepth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index++) {
    if (source[index] === "(") parenthesesDepth++;
    if (source[index] === ")") parenthesesDepth--;
    if (parenthesesDepth === 0) {
      parametersEnd = index;
      break;
    }
  }

  const bodyStart = source.indexOf("{", parametersEnd);
  assert.notEqual(bodyStart, -1, `${name} deve ter corpo`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}") depth--;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }

  assert.fail(`corpo de ${name} não foi fechado`);
}

test("todas as Server Actions administrativas exigem usuário autenticado", async () => {
  for (const [path, actionNames] of Object.entries(guardedActions)) {
    const source = await readFile(new URL(path, root), "utf8");

    for (const actionName of actionNames) {
      const body = getFunctionBody(source, actionName);
      assert.match(
        body,
        /await requireAuthenticatedUser\(\)/,
        `${path}:${actionName} deve validar a sessão`,
      );
    }
  }
});

test("ações públicas de revisão por token permanecem sem guarda administrativa", async () => {
  const source = await readFile(new URL("src/app/actions/review.ts", root), "utf8");

  for (const actionName of publicReviewActions) {
    const body = getFunctionBody(source, actionName);
    assert.doesNotMatch(
      body,
      /requireAuthenticatedUser/,
      `${actionName} deve permanecer pública por token`,
    );
  }
});

test("helper compartilhado é server-only, valida getUser e redireciona", async () => {
  const source = await readFile(
    new URL("src/lib/supabase/require-authenticated-user.ts", root),
    "utf8",
  );

  assert.match(source, /import "server-only";/);
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.match(source, /if \(!user\) redirect\("\/login"\)/);
  assert.match(source, /return \{ supabase, user \}/);
});
