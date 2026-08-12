import assert from "node:assert/strict";
import test from "node:test";

import { isAdminRoute } from "../src/lib/proxy-route-policy.ts";

test("classifica /sites e qualquer subrota como área autenticada", () => {
  assert.equal(isAdminRoute("/sites"), true);
  assert.equal(isAdminRoute("/sites/acme"), true);
  assert.equal(isAdminRoute("/sites/acme/configuracoes"), true);
});

test("não classifica prefixos parecidos com /sites como área autenticada", () => {
  assert.equal(isAdminRoute("/sites-publicos"), false);
});

