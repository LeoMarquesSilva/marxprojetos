import assert from "node:assert/strict";
import { parseCaptureTargets } from "./portfolio-cover-targets.mjs";

assert.deepEqual(
  parseCaptureTargets(
    [
      "pereira-garcia",
      "bismarchi-pires=https://www.bismarchipires.com.br/",
    ],
    "http://127.0.0.1:4321",
  ),
  [
    {
      slug: "pereira-garcia",
      url: "http://127.0.0.1:4321/sites/pereira-garcia/index.html",
    },
    {
      slug: "bismarchi-pires",
      url: "https://www.bismarchipires.com.br/",
    },
  ],
);

assert.throws(
  () =>
    parseCaptureTargets(
      ["Bad Slug=https://example.com"],
      "http://local",
    ),
  /Invalid capture target/,
);
assert.throws(
  () => parseCaptureTargets(["safe=file:///etc/passwd"], "http://local"),
  /Invalid capture target/,
);
