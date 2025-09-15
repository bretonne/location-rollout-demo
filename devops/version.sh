#!/usr/bin/env bash
# Common version handling for deploy scripts
# Usage: source /path/to/devops/version.sh
# Then call get_current_version [bump [major|minor|patch]]

get_current_version() {
  local cmd="${1:-}"
  local bump_type="${2:-patch}"

  # Determine repo root (one level above this devops dir)
  local DEVOPS_DIR
  DEVOPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local REPO_ROOT
  REPO_ROOT="$(cd "${DEVOPS_DIR}/.." && pwd)"

  # Default VERSION_FILE if caller hasn't set one
  : "${VERSION_FILE:=${REPO_ROOT}/backend/VERSION}"

  # Always read the authoritative version from the VERSION file (or create default)
  local CURRENT_VERSION
  if [[ -f "${VERSION_FILE}" ]]; then
    CURRENT_VERSION="$(tr -d ' \n\r' < "${VERSION_FILE}")"
  else
    echo "No VERSION found; creating default 0.1.0 at ${VERSION_FILE}"
    mkdir -p "$(dirname "${VERSION_FILE}")" || true
    echo "0.1.0" > "${VERSION_FILE}"
    CURRENT_VERSION="0.1.0"
  fi

  # Validate semver and capture parts
  local semver_regex='^([0-9]+)\.([0-9]+)\.([0-9]+)$'
  if [[ "${CURRENT_VERSION}" =~ ${semver_regex} ]]; then
    local major=${BASH_REMATCH[1]}
    local minor=${BASH_REMATCH[2]}
    local patch=${BASH_REMATCH[3]}
  else
    echo "ERROR: current version '${CURRENT_VERSION}' is not a valid semver (X.Y.Z)"
    return 1
  fi

  # Handle bump command if requested
  if [[ "${cmd}" == "bump" ]]; then
    case "${bump_type}" in
      major)
        major=$((major + 1)); minor=0; patch=0;;
      minor)
        minor=$((minor + 1)); patch=0;;
      patch)
        patch=$((patch + 1));;
      *)
        echo "Invalid bump type: ${bump_type}. Use major, minor, or patch."; return 1;;
    esac
    local NEW_VERSION="${major}.${minor}.${patch}"
    echo "${NEW_VERSION}" > "${VERSION_FILE}"
    echo "Bumped version: ${CURRENT_VERSION} -> ${NEW_VERSION}"
    CURRENT_VERSION="${NEW_VERSION}"
  fi

  # Export VERSION for callers (authoritative value from file)
  VERSION="${CURRENT_VERSION}"
  export VERSION
}
