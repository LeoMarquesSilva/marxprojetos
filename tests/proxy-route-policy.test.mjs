import assert from "node:assert/strict";
import test from "node:test";

import { isAdminRoute } from "../src/lib/proxy-route-policy.ts";

test("classifica a listagem e a página de um projeto em /sites como área autenticada", () => {
  assert.equal(isAdminRoute("/sites"), true);
  assert.equal(isAdminRoute("/sites/acme"), true);
});

test("mantém público o build estático em /sites/<slug>/... usado pelo iframe da revisão", () => {
  assert.equal(isAdminRoute("/sites/acme/index.html"), false);
  assert.equal(isAdminRoute("/sites/acme/contato/index.html"), false);
  assert.equal(isAdminRoute("/sites/acme/_astro/app.css"), false);
});

test("não classifica prefixos parecidos com /sites como área autenticada", () => {
  assert.equal(isAdminRoute("/sites-publicos"), false);
});

