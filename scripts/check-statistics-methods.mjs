import assert from "node:assert/strict";
import { METHOD_GROUPS, METHOD_LOOKUP, actionLabel, resolveLegacyAction } from "../statistics-methods.js";

const expected = {
  descriptive: ["discovery", "summary", "scatter"],
  probability: ["moments", "discrete", "continuous"],
  estimation: ["sampling", "unbiased", "interval", "difference-ci"],
  testing: ["hypothesis", "welch", "paired", "anova", "binomial", "categorical", "fisher", "bh"],
  regression: ["regression", "multiple", "logistic", "diagnostics", "prediction"],
  bayesian: ["bayes", "mcmc"],
  workflow: ["exercise"],
};
assert.deepEqual(METHOD_GROUPS.map(group => group.id), Object.keys(expected));
assert.deepEqual(METHOD_GROUPS.map(group => group.name), ["記述・探索", "確率分布", "標本・推定", "仮説検定", "回帰分析", "ベイズ推論", "分析の進め方"]);
assert.equal(METHOD_LOOKUP.get("exercise").label, "分析の流れを確認する");
assert.equal(METHOD_LOOKUP.size, 26);
assert.equal(METHOD_GROUPS.flatMap(group => group.methods).length, 26, "A method was duplicated or removed");
for (const group of METHOD_GROUPS) {
  assert.deepEqual(group.methods.map(method => method[0]), expected[group.id]);
  assert.doesNotMatch(group.name, /^\d/u);
  assert.doesNotMatch(JSON.stringify(group), /総合演習/u);
  for (const [id, label, copy] of group.methods) {
    assert(label && copy);
    assert.equal(METHOD_LOOKUP.get(id).group, group);
  }
}
const previousDefaults = ["summary", "moments", "discrete", "continuous", "sampling", "interval", "hypothesis", "welch", "categorical", "anova", "regression", "diagnostics", "logistic", "bayes", "exercise"];
for (const [index, method] of previousDefaults.entries()) {
  const action = `${String(index + 1).padStart(2, "0")} 次の分析`;
  assert.equal(resolveLegacyAction(action).id, method, `${action}: destination changed`);
  assert.equal(actionLabel(action), "次の分析");
}
assert.equal(resolveLegacyAction("条件を確認する"), null);
assert.equal(actionLabel("2群差・分散比の区間"), "2群差・分散比の区間");
assert.equal(actionLabel("95%信頼区間"), "95%信頼区間");
console.log("PASS statistics categories: seven purpose-based groups, all 26 methods retained, legacy action targets preserved, no visible lecture numbers");
