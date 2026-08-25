#!/bin/sh
# Uji logika murni (parsing, merge, export) tanpa browser.
cd "$(dirname "$0")/.." || exit 1
fail=0
for f in test/*.test.mjs; do
  echo "── $f"
  node "$f" || fail=1
done
[ $fail -eq 0 ] && echo "\nSemua test lolos." || echo "\nAda test gagal."
exit $fail
