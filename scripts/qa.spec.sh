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

test_doctor_survives_failing_maestro() {
  maestro() {
    printf 'synthetic maestro failure\n' >&2
    return 1
  }
  local output
  output="$(print_doctor)"
  unset -f maestro
  assert_equal 'Maestro: synthetic maestro failure' \
    "$(printf '%s\n' "${output}" | sed -n '1p')" \
    'doctor reports an installed but failing Maestro command'
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

test_sprint_16_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-16" \
    "$(resolve_suite sprint 16)" \
    'Sprint 16 resolves to independently reported scenarios'
}

test_sprint_17_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-17" \
    "$(resolve_suite sprint 17)" \
    'Sprint 17 resolves to independently reported scenarios'
}

test_sprint_18_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-18" \
    "$(resolve_suite sprint 18)" \
    'Sprint 18 resolves to independently reported scenarios'
}

test_sprint_19_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-19" \
    "$(resolve_suite sprint 19)" \
    'Sprint 19 resolves to independently reported scenarios'
}

test_sprint_20_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-20" \
    "$(resolve_suite sprint 20)" \
    'Sprint 20 resolves to independently reported scenarios'
}

test_sprint_21_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-21" \
    "$(resolve_suite sprint 21)" \
    'Sprint 21 resolves to independently reported scenarios'
}

test_sprint_22_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-22" \
    "$(resolve_suite sprint 22)" \
    'Sprint 22 resolves to independently reported scenarios'
}

test_sprint_23_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-23" \
    "$(resolve_suite sprint 23)" \
    'Sprint 23 resolves to independently reported scenarios'
}

test_sprint_24_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-24" \
    "$(resolve_suite sprint 24)" \
    'Sprint 24 resolves to independently reported scenarios'
}

test_sprint_25_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-25" \
    "$(resolve_suite sprint 25)" \
    'Sprint 25 resolves to independently reported scenarios'
}

test_sprint_26_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-26" \
    "$(resolve_suite sprint 26)" \
    'Sprint 26 resolves to independently reported scenarios'
}

test_sprint_27_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-27" \
    "$(resolve_suite sprint 27)" \
    'Sprint 27 resolves to independently reported scenarios'
}

test_sprint_29_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-29" \
    "$(resolve_suite sprint 29)" \
    'Sprint 29 resolves to independently reported scenarios'
}

test_sprint_30_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-30" \
    "$(resolve_suite sprint 30)" \
    'Sprint 30 resolves to independently reported scenarios'
}

test_sprint_31_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-31" \
    "$(resolve_suite sprint 31)" \
    'Sprint 31 resolves to independently reported scenarios'
}

test_sprint_32_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-32" \
    "$(resolve_suite sprint 32)" \
    'Sprint 32 resolves to independently reported scenarios'
}

test_sprint_33_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-33" \
    "$(resolve_suite sprint 33)" \
    'Sprint 33 resolves to independently reported scenarios'
}

test_sprint_34_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-34" \
    "$(resolve_suite sprint 34)" \
    'Sprint 34 resolves to independently reported scenarios'
}

test_sprint_35_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-35" \
    "$(resolve_suite sprint 35)" \
    'Sprint 35 resolves to independently reported scenarios'
}

test_sprint_36_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-36" \
    "$(resolve_suite sprint 36)" \
    'Sprint 36 resolves to independently reported scenarios'
}

test_sprint_37_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-37" \
    "$(resolve_suite sprint 37)" \
    'Sprint 37 resolves to independently reported scenarios'
}

test_sprint_38_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-38" \
    "$(resolve_suite sprint 38)" \
    'Sprint 38 resolves to independently reported scenarios'
}

test_sprint_39_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-39" \
    "$(resolve_suite sprint 39)" \
    'Sprint 39 resolves to independently reported scenarios'
}

test_sprint_40_resolution() {
  assert_equal \
    "${test_root}/e2e/mobile/suites/sprint-40" \
    "$(resolve_suite sprint 40)" \
    'Sprint 40 resolves to independently reported scenarios'
}

test_human_readable_report() {
  local temporary_directory
  temporary_directory="$(mktemp -d)"
  trap 'rm -rf -- "${temporary_directory}"' RETURN
  cat >"${temporary_directory}/junit.xml" <<'EOF'
<testsuites><testsuite tests="2" failures="1">
  <testcase name="Empty progress" file="empty.yaml" time="1.25" status="SUCCESS"/>
  <testcase name="Workout progress" file="workout.yaml" time="2.5"><failure message="Expected &quot;1 actual set&quot;"/></testcase>
</testsuite></testsuites>
EOF
  local report_status=0
  node "${test_root}/scripts/qa-report.mjs" \
    "${temporary_directory}/junit.xml" \
    "${temporary_directory}/report.txt" \
    "${temporary_directory}/report.json" \
    'sprint-16' 'ios' 'test-device' "${temporary_directory}" >/dev/null || report_status="$?"
  assert_equal '1' "${report_status}" \
    'scenario failure produces a nonzero report status'
  assert_equal 'PASS  Empty progress (1.3s)' \
    "$(sed -n '2p' "${temporary_directory}/report.txt")" \
    'human-readable report includes passing scenario'
  assert_equal 'failed' \
    "$(sed -nE 's/.*"status": "([^"]+)".*/\1/p' "${temporary_directory}/report.json" | tail -n 1)" \
    'JSON report preserves failed scenario status'
  rm -rf -- "${temporary_directory}"
  trap - RETURN
}

test_extract_available_ios_devices
test_doctor_survives_failing_maestro
test_junit_summary
test_sprint_15_resolution
test_sprint_16_resolution
test_sprint_17_resolution
test_sprint_18_resolution
test_sprint_19_resolution
test_sprint_20_resolution
test_sprint_21_resolution
test_sprint_22_resolution
test_sprint_23_resolution
test_sprint_24_resolution
test_sprint_25_resolution
test_sprint_26_resolution
test_sprint_27_resolution
test_sprint_29_resolution
test_sprint_30_resolution
test_sprint_31_resolution
test_sprint_32_resolution
test_sprint_33_resolution
test_sprint_34_resolution
test_sprint_35_resolution
test_sprint_36_resolution
test_sprint_37_resolution
test_sprint_38_resolution
test_sprint_39_resolution
test_sprint_40_resolution
test_human_readable_report
printf 'QA wrapper tests passed.\n'
