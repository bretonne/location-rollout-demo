#!/usr/bin/env bash
set -euo pipefail

APP_NAME="location-rollout-api"
CLUSTER_NAME="demo-cluster"
NAMESPACE="kubecon-demo"

# Base dir (repo/backend)
BASEDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="${BASEDIR}/VERSION"
K8S_MANIFEST="${BASEDIR}/../k8s/api-deploy.yaml"

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

COMMON_VERSION_SH="${BASEDIR}/../devops/version.sh"
if [[ -f "${COMMON_VERSION_SH}" ]]; then
  # shellcheck source=/dev/null
  source "${COMMON_VERSION_SH}"
else
  echo "Missing shared version helper: ${COMMON_VERSION_SH}"
  exit 1
fi

# Populate VERSION (accepts: bump [major|minor|patch])
get_current_version "$@"

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
