#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

readonly app_id='com.fitnessapp.dev'
readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly repository_root="$(cd -- "${script_dir}/.." && pwd)"
readonly suite_root="${repository_root}/e2e/mobile/suites"
readonly artifact_root="${repository_root}/artifacts/qa"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/qa.sh doctor
  ./scripts/qa.sh reset [--platform ios|android] [--device ID]
  ./scripts/qa.sh smoke [--platform ios|android] [--device ID]
  ./scripts/qa.sh regression [--platform ios|android] [--device ID]
  ./scripts/qa.sh sprint NUMBER [--platform ios|android] [--device ID]

Clean-state suites remove data stored by com.fitnessapp.dev on the selected
simulator or emulator. The script never erases the whole virtual device.
EOF
}

fail() {
  printf 'QA error: %s\n' "$1" >&2
  exit 2
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

list_ios_devices() {
  if ! has_command xcrun; then return; fi
  xcrun simctl list devices booted 2>/dev/null |
    sed -nE 's/^[[:space:]]+.*\(([0-9A-Fa-f-]{36})\) \(Booted\)[[:space:]]*$/\1/p' || true
}

extract_available_ios_device_ids() {
  sed -nE \
    's/^[[:space:]]+iPhone.*\(([0-9A-Fa-f-]{36})\) \((Booted|Shutdown)\).*$/\1/p'
}

list_available_ios_devices() {
  if ! has_command xcrun; then return; fi
  xcrun simctl list devices available 2>/dev/null |
    extract_available_ios_device_ids || true
}

list_android_devices() {
  if ! has_command adb; then return; fi
  adb devices 2>/dev/null |
    awk '$1 ~ /^emulator-/ && $2 == "device" { print $1 }' || true
}

print_doctor() {
  local maestro_status='missing'
  local ios_tool_status='missing'
  local android_tool_status='missing'
  local ios_devices='none'
  local android_devices='none'

  if has_command maestro; then
    maestro_status="$(maestro --version 2>&1 | head -n 1 || true)"
  fi
  if has_command xcrun; then ios_tool_status='available'; fi
  if has_command adb; then android_tool_status='available'; fi

  local detected_ios
  local detected_android
  detected_ios="$(list_ios_devices)"
  detected_android="$(list_android_devices)"
  if [[ -n "${detected_ios}" ]]; then ios_devices="${detected_ios//$'\n'/, }"; fi
  if [[ -n "${detected_android}" ]]; then android_devices="${detected_android//$'\n'/, }"; fi

  printf 'Maestro: %s\n' "${maestro_status}"
  printf 'iOS tooling: %s\n' "${ios_tool_status}"
  printf 'Booted iOS simulators: %s\n' "${ios_devices}"
  printf 'Android tooling: %s\n' "${android_tool_status}"
  printf 'Running Android emulators: %s\n' "${android_devices}"
  printf 'Target app ID: %s\n' "${app_id}"
}

resolve_suite() {
  local command_name="$1"
  local sprint_number="$2"

  case "${command_name}" in
    reset) printf '%s/reset.yaml\n' "${suite_root}" ;;
    smoke) printf '%s/smoke.yaml\n' "${suite_root}" ;;
    regression) printf '%s/regression\n' "${suite_root}" ;;
    sprint)
      case "${sprint_number}" in
        6 | 8 | 9 | 10 | 11 | 12 | 13 | 15)
          printf '%s/sprint-%s.yaml\n' "${suite_root}" "${sprint_number}"
          ;;
        16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39)
          printf '%s/sprint-%s\n' "${suite_root}" "${sprint_number}"
          ;;
        5 | 7)
          fail "Sprint ${sprint_number} has no repository manual QA specification."
          ;;
        *) fail "Unsupported sprint '${sprint_number}'. Available: 6, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39." ;;
      esac
      ;;
    *) fail "Unknown suite '${command_name}'." ;;
  esac
}

select_platform_and_device() {
  local requested_platform="$1"
  local requested_device="$2"
  local ios_devices
  local android_devices
  ios_devices="$(list_ios_devices)"
  android_devices="$(list_android_devices)"

  if [[ -z "${requested_platform}" ]]; then
    if [[ -n "${ios_devices}" && -n "${android_devices}" ]]; then
      fail 'Both iOS and Android targets are active; pass --platform.'
    elif [[ -n "${ios_devices}" ]]; then
      requested_platform='ios'
    elif [[ -n "${android_devices}" ]]; then
      requested_platform='android'
    else
      fail 'No booted iOS Simulator or running Android Emulator was found.'
    fi
  fi

  local candidates
  if [[ "${requested_platform}" == 'ios' ]]; then
    has_command xcrun || fail 'xcrun is required for iOS QA.'
    candidates="${ios_devices}"
  else
    has_command adb || fail 'adb is required for Android QA.'
    candidates="${android_devices}"
  fi

  if [[ -n "${requested_device}" ]]; then
    if ! grep -Fqx -- "${requested_device}" <<<"${candidates}"; then
      fail "Device '${requested_device}' is not an active ${requested_platform} virtual device."
    fi
  else
    local count
    count="$(grep -c . <<<"${candidates}" || true)"
    if [[ "${count}" -eq 0 ]]; then
      fail "No active ${requested_platform} virtual device was found."
    elif [[ "${count}" -gt 1 ]]; then
      fail "Multiple ${requested_platform} devices are active; pass --device."
    fi
    requested_device="${candidates}"
  fi

  selected_platform="${requested_platform}"
  selected_device="${requested_device}"
}

select_and_boot_ios_device() {
  local requested_device="$1"
  has_command xcrun || fail 'xcrun is required for iOS QA.'
  has_command open || fail 'The macOS open command is required for iOS QA.'

  local booted_devices
  local available_devices
  booted_devices="$(list_ios_devices)"
  available_devices="$(list_available_ios_devices)"

  if [[ -n "${requested_device}" ]]; then
    if ! grep -Fqx -- "${requested_device}" <<<"${available_devices}"; then
      fail "Device '${requested_device}' is not an available iPhone Simulator."
    fi
  else
    local booted_count
    booted_count="$(grep -c . <<<"${booted_devices}" || true)"
    if [[ "${booted_count}" -eq 1 ]]; then
      requested_device="${booted_devices}"
    elif [[ "${booted_count}" -gt 1 ]]; then
      fail 'Multiple iOS devices are booted; pass --device.'
    else
      requested_device="$(head -n 1 <<<"${available_devices}")"
      [[ -n "${requested_device}" ]] ||
        fail 'No available iPhone Simulator was found. Install a simulator runtime in Xcode.'
      printf 'Selected default iOS Simulator: %s\n' "${requested_device}"
    fi
  fi

  if ! grep -Fqx -- "${requested_device}" <<<"${booted_devices}"; then
    printf 'Booting iOS Simulator: %s\n' "${requested_device}"
    xcrun simctl boot "${requested_device}" ||
      fail "iOS Simulator ${requested_device} could not be booted."
  fi
  open -a Simulator --args -CurrentDeviceUDID "${requested_device}" ||
    fail 'The Simulator application could not be opened.'
  xcrun simctl bootstatus "${requested_device}" -b ||
    fail "iOS Simulator ${requested_device} did not finish booting."

  selected_platform='ios'
  selected_device="${requested_device}"
}

assert_app_installed() {
  if [[ "${selected_platform}" == 'ios' ]]; then
    xcrun simctl get_app_container "${selected_device}" "${app_id}" app >/dev/null 2>&1 ||
      fail "${app_id} is not installed on iOS device ${selected_device}."
  else
    adb -s "${selected_device}" shell pm path "${app_id}" 2>/dev/null |
      grep -q '^package:' ||
      fail "${app_id} is not installed on Android device ${selected_device}."
  fi
}

prepare_ios_application() {
  local artifact_directory="$1"
  printf 'Preparation: building and installing current iOS Release app\n'
  set +o errexit
  env -u NO_COLOR FORCE_COLOR=0 \
    pnpm --filter @fitness/mobile exec expo run:ios \
      --configuration Release \
      --device "${selected_device}" \
      --no-bundler 2>&1 | tee "${artifact_directory}/preparation.log"
  local preparation_status="${PIPESTATUS[0]}"
  set -o errexit
  if [[ "${preparation_status}" -ne 0 ]]; then
    printf 'QA setup failed while building or installing the iOS app.\n' >&2
    return "${preparation_status}"
  fi
  if ! xcrun simctl get_app_container \
    "${selected_device}" "${app_id}" app >/dev/null 2>&1; then
    printf 'QA setup failed because the iOS app was not installed after the build.\n' >&2
    return 2
  fi
  printf 'Preparation: passed\n'
}

junit_attribute() {
  local report_path="$1"
  local attribute="$2"
  sed -nE "/<testsuite/ s/.* ${attribute}=\"([0-9]+)\".*/\1/p" \
    "${report_path}" | head -n 1
}

print_result_summary() {
  local result_kind="$1"
  local status="$2"
  local started_epoch_seconds="$3"
  local artifact_directory="$4"
  local elapsed_seconds
  elapsed_seconds="$(($(date +%s) - started_epoch_seconds))"

  printf '\nQA result summary\n'
  printf 'Result: %s\n' "${result_kind}"
  printf 'Suite: %s\n' "${suite_name}"
  printf 'Platform: %s\n' "${selected_platform}"
  printf 'Device: %s\n' "${selected_device}"
  printf 'Duration: %ss\n' "${elapsed_seconds}"
  printf 'Exit status: %s\n' "${status}"

  local report_path="${artifact_directory}/junit.xml"
  if [[ -f "${report_path}" ]]; then
    local tests failures errors skipped passed
    tests="$(junit_attribute "${report_path}" tests)"
    failures="$(junit_attribute "${report_path}" failures)"
    errors="$(junit_attribute "${report_path}" errors)"
    skipped="$(junit_attribute "${report_path}" skipped)"
    tests="${tests:-0}"
    failures="${failures:-0}"
    errors="${errors:-0}"
    skipped="${skipped:-0}"
    passed="$((tests - failures - errors - skipped))"
    printf 'Tests: %s passed, %s failed, %s errors, %s skipped, %s total\n' \
      "${passed}" "${failures}" "${errors}" "${skipped}" "${tests}"
  else
    printf 'Tests: no JUnit report was produced\n'
  fi
  printf 'Artifacts: %s\n' "${artifact_directory}"
}

main() {
  if [[ "$#" -eq 0 ]]; then usage; exit 2; fi

  local command_name="$1"
  shift
  if [[ "${command_name}" == 'doctor' ]]; then
    if [[ "$#" -ne 0 ]]; then fail 'doctor does not accept additional arguments.'; fi
    print_doctor
    exit 0
  fi

  local sprint_number=''
  if [[ "${command_name}" == 'sprint' ]]; then
    if [[ "$#" -eq 0 ]]; then fail 'sprint requires a number.'; fi
    sprint_number="$1"
    shift
  fi

  local requested_platform=''
  local requested_device=''
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --platform)
        [[ "$#" -ge 2 ]] || fail '--platform requires ios or android.'
        requested_platform="$2"
        [[ "${requested_platform}" == 'ios' || "${requested_platform}" == 'android' ]] ||
          fail '--platform must be ios or android.'
        shift 2
        ;;
      --device)
        [[ "$#" -ge 2 ]] || fail '--device requires an identifier.'
        requested_device="$2"
        shift 2
        ;;
      --help | -h) usage; exit 0 ;;
      *) fail "Unknown argument '$1'." ;;
    esac
  done

  local suite_path
  suite_path="$(resolve_suite "${command_name}" "${sprint_number}")"
  [[ -e "${suite_path}" ]] || fail "Suite is missing: ${suite_path}"
  has_command maestro || fail 'Maestro is not installed. Run ./scripts/qa.sh doctor for details.'

  local run_started_epoch_seconds
  run_started_epoch_seconds="$(date +%s)"

  selected_platform=''
  selected_device=''
  local should_prepare_ios='false'
  if [[ "${requested_platform}" == 'ios' ]]; then
    select_and_boot_ios_device "${requested_device}"
    should_prepare_ios='true'
  else
    select_platform_and_device "${requested_platform}" "${requested_device}"
  fi

  local run_timestamp
  local suite_name
  local artifact_directory
  run_timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  suite_name="$(basename "${suite_path}" .yaml)"
  artifact_directory="${artifact_root}/${run_timestamp}/${selected_platform}/${suite_name}"
  mkdir -p "${artifact_directory}"

  printf 'Suite: %s\n' "${suite_name}"
  printf 'Platform: %s\n' "${selected_platform}"
  printf 'Device: %s\n' "${selected_device}"
  printf 'Application: %s\n' "${app_id}"
  printf 'State: app-local data will be cleared by the suite\n'
  printf 'Artifacts: %s\n' "${artifact_directory}"

  if [[ "${should_prepare_ios}" == 'true' ]]; then
    local preparation_status=0
    prepare_ios_application "${artifact_directory}" || preparation_status="$?"
    if [[ "${preparation_status}" -ne 0 ]]; then
      print_result_summary \
        'SETUP FAILED' \
        "${preparation_status}" \
        "${run_started_epoch_seconds}" \
        "${artifact_directory}"
      exit "${preparation_status}"
    fi
  else
    assert_app_installed
  fi

  set +o errexit
  maestro --platform="${selected_platform}" --device="${selected_device}" test \
    --debug-output="${artifact_directory}" \
    --format=junit \
    --output="${artifact_directory}/junit.xml" \
    --test-output-dir="${artifact_directory}" \
    "${suite_path}" 2>&1 | tee "${artifact_directory}/cli.log"
  local maestro_status="${PIPESTATUS[0]}"
  set -o errexit

  local report_status=0
  if [[ -f "${artifact_directory}/junit.xml" ]]; then
    node "${script_dir}/qa-report.mjs" \
      "${artifact_directory}/junit.xml" \
      "${artifact_directory}/report.txt" \
      "${artifact_directory}/report.json" \
      "${suite_name}" \
      "${selected_platform}" \
      "${selected_device}" \
      "${artifact_directory}" || report_status="$?"
  else
    printf 'QA report error: Maestro produced no JUnit report.\n' >&2
    report_status=65
  fi

  local final_status="${maestro_status}"
  if [[ "${final_status}" -eq 0 && "${report_status}" -ne 0 ]]; then
    final_status="${report_status}"
  fi

  if [[ "${final_status}" -eq 0 ]]; then
    print_result_summary \
      'PASSED' \
      "${final_status}" \
      "${run_started_epoch_seconds}" \
      "${artifact_directory}"
  else
    print_result_summary \
      'FAILED' \
      "${final_status}" \
      "${run_started_epoch_seconds}" \
      "${artifact_directory}" >&2
  fi
  exit "${final_status}"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
