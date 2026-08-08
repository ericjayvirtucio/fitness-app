#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

readonly test_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=qa.sh
source "${test_root}/scripts/qa.sh"

assert_equal() {
  local expected="$1"
  local actual="$2"
  local message="$3"
  if [[ "${expected}" != "${actual}" ]]; then
    printf 'QA wrapper test failed: %s\nExpected: %s\nActual: %s\n' \
      "${message}" "${expected}" "${actual}" >&2
    exit 1
  fi
}

test_extract_available_ios_devices() {
  local actual
  actual="$(extract_available_ios_device_ids <<'EOF'
-- iOS 26.0 --
    iPhone 17 Pro (11111111-1111-1111-1111-111111111111) (Shutdown)
    iPhone Air (22222222-2222-2222-2222-222222222222) (Booted)
    iPad Pro (33333333-3333-3333-3333-333333333333) (Shutdown)
EOF
)"
  assert_equal \
    $'11111111-1111-1111-1111-111111111111\n22222222-2222-2222-2222-222222222222' \
    "${actual}" \
    'available iOS selection includes iPhones only in simctl order'
}

test_junit_summary() {
  local temporary_directory
  temporary_directory="$(mktemp -d)"
  trap 'rm -rf -- "${temporary_directory}"' RETURN
  cat >"${temporary_directory}/junit.xml" <<'EOF'
<testsuites tests="7" failures="1" errors="1" skipped="2">
</testsuites>
EOF
  assert_equal '7' "$(junit_attribute "${temporary_directory}/junit.xml" tests)" \
    'JUnit test count is parsed'
  assert_equal '1' "$(junit_attribute "${temporary_directory}/junit.xml" failures)" \
    'JUnit failure count is parsed'
  assert_equal '2' "$(junit_attribute "${temporary_directory}/junit.xml" skipped)" \
    'JUnit skipped count is parsed'
  rm -rf -- "${temporary_directory}"
  trap - RETURN
}

test_sprint_15_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-15.yaml" \
    "$(resolve_suite sprint 15)" \
    'Sprint 15 resolves through the stable wrapper contract'
}

test_extract_available_ios_devices
test_junit_summary
test_sprint_15_resolution
printf 'QA wrapper tests passed.\n'
