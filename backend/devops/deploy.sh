#!/usr/bin/env bash
set -euo pipefail

APP_NAME="location-rollout-api"
CLUSTER_NAME="demo-cluster"
NAMESPACE="kubecon-demo"

# Base dir (repo/backend)
BASEDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="${BASEDIR}/VERSION"
K8S_MANIFEST="${BASEDIR}/k8s/api-deploy.yaml"

usage() {
  cat <<EOF
Usage: $(basename "$0") [bump [major|minor|patch]]

Commands:
  bump [major|minor|patch]   Increment semantic version in ${VERSION_FILE} (default: patch)

You can also set VERSION environment variable to override the value in ${VERSION_FILE}.
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

# Read current version (from env or file)
if [[ -n "${VERSION:-}" ]]; then
  CURRENT_VERSION="${VERSION}"
elif [[ -f "${VERSION_FILE}" ]]; then
  CURRENT_VERSION="$(tr -d ' \n\r' < "${VERSION_FILE}")"
else
  echo "No VERSION found; creating default 0.1.0"
  echo "0.1.0" > "${VERSION_FILE}"
  CURRENT_VERSION="0.1.0"
fi

semver_regex='^([0-9]+)\.([0-9]+)\.([0-9]+)$'
if [[ ! "${CURRENT_VERSION}" =~ ${semver_regex} ]]; then
  echo "ERROR: current version '${CURRENT_VERSION}' is not a valid semver (X.Y.Z)"
  exit 1
fi

# Handle bump command
if [[ "${1:-}" == "bump" ]]; then
  bump_type="${2:-patch}"
  major=${BASH_REMATCH[1]}
  minor=${BASH_REMATCH[2]}
  patch=${BASH_REMATCH[3]}
  case "${bump_type}" in
    major)
      major=$((major + 1)); minor=0; patch=0;;
    minor)
      minor=$((minor + 1)); patch=0;;
    patch)
      patch=$((patch + 1));;
    *)
      echo "Invalid bump type: ${bump_type}. Use major, minor, or patch."; exit 1;;
  esac
  NEW_VERSION="${major}.${minor}.${patch}"
  echo "${NEW_VERSION}" > "${VERSION_FILE}"
  echo "Bumped version: ${CURRENT_VERSION} -> ${NEW_VERSION}"
  CURRENT_VERSION="${NEW_VERSION}"
fi

VERSION="${CURRENT_VERSION}"
IMAGE_TAG="${APP_NAME}:${VERSION}"

echo "Building Docker image ${IMAGE_TAG} from ${BASEDIR}..."
docker build -t "${IMAGE_TAG}" "${BASEDIR}"

echo "Loading image into kind cluster ${CLUSTER_NAME}..."
kind load docker-image "${IMAGE_TAG}" --name "${CLUSTER_NAME}"

# Export for envsubst
export VERSION IMAGE_TAG

echo "Rendering manifest and applying to namespace ${NAMESPACE}..."
apply_output=$(envsubst '$VERSION $IMAGE_TAG' < "${K8S_MANIFEST}" | kubectl apply -n "${NAMESPACE}" -f - 2>&1 || true)

echo "$apply_output"

# If unchanged, explicitly set image and label so pods pick up the new image
if echo "$apply_output" | grep -q -i "unchanged"; then
  echo "Manifest reported 'unchanged' — updating deployment image and label explicitly..."
  kubectl set image deployment/api api="${IMAGE_TAG}" -n "${NAMESPACE}"
  kubectl label deployment api version="${VERSION}" -n "${NAMESPACE}" --overwrite
  kubectl rollout restart deployment/api -n "${NAMESPACE}"
fi

# Wait for rollout
echo "Waiting for deployment rollout to finish..."
kubectl rollout status deployment/api -n "${NAMESPACE}" --timeout=120s

echo "✅ Backend API deployed to namespace ${NAMESPACE} (version: ${VERSION})"
